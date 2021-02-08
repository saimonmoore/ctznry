import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { CreateCommunityPopup } from './com/popups/create-community.js'
import * as toast from './com/toast.js'
import { pluralize } from './lib/strings.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import './com/header.js'
import './com/button.js'
import './com/composer.js'
import './com/feed.js'
import './com/img-fallbacks.js'

class CtznApp extends LitElement {
  static get properties () {
    return {
      isComposingPost: {type: Boolean},
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      numNewItems: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isComposingPost = false
    this.searchQuery = ''
    this.isEmpty = false
    this.numNewItems = 0
    this.loadTime = Date.now()
    this.myCommunities = [
      {userId: 'test@dev1.localhost', displayName: 'Test Community 1', avatarUrl: 'http://localhost:15001/ctzn/avatar/test'},
      {userId: 'test2@dev1.localhost', displayName: 'Test Community 2', avatarUrl: 'http://localhost:15001/ctzn/avatar/test2'},
      {userId: 'test3@dev1.localhost', displayName: 'Test Community 3', avatarUrl: 'http://localhost:15001/ctzn/avatar/test3'},
      {userId: 'test4@dev1.localhost', displayName: 'Test Community 4', avatarUrl: 'http://localhost:15001/ctzn/avatar/test4'}
    ]

    this.load()

    setInterval(this.checkNewItems.bind(this), 5e3)

    window.addEventListener('popstate', (event) => {
      this.configFromQP()
    })
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    await session.setup()
    if (!session.active) {
      return this.requestUpdate()
    }

    if (this.shadowRoot.querySelector('ctzn-feed')) {
      this.loadTime = Date.now()
      this.numNewItems = 0
      this.shadowRoot.querySelector('ctzn-feed').load({clearCurrent})
    }
    
    if ((new URL(window.location)).searchParams.has('composer')) {
      this.isComposingPost = true
      window.history.replaceState({}, null, '/')
    }
  }

  async checkNewItems () {
    // TODO check for new items
    // var query = PATH_QUERIES[location.pathname.slice(1) || 'all']
    // if (!query) return
    // var {count} = await beaker.index.gql(`
    //   query NewItems ($paths: [String!]!, $loadTime: Long!) {
    //     count: recordCount(
    //       paths: $paths
    //       after: {key: "crtime", value: $loadTime}
    //     )
    //   }
    // `, {paths: query, loadTime: this.loadTime})
    // this.numNewItems = count
  }

  get isLoading () {
    let queryViewEls = Array.from(this.shadowRoot.querySelectorAll('ctzn-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header></ctzn-header>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    return html`
      <div>
        <section class="mb-4">
          <span class="fas fa-search"></span>
          ${!!this.searchQuery ? html`
            <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
          ` : ''}
          <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
        </section>
        <section class="mb-4">
          <h3 class="mb-1 font-bold text-gray-600">My Communities</h3>
          ${this.myCommunities?.length ? html`
            <div class="mt-2">
              ${repeat(this.myCommunities, community => html`
                <a href="/${community.userId}" data-tooltip=${community.displayName}>
                  <img class="inline-block rounded-full w-10 h-10 object-cover" src="${community.avatarUrl}">
                </a>
              `)}
            </div>
          ` : html`
            <div class="px-3 py-2 bg-gray-200 text-gray-600 text-xs">
              Join a community to get connected to more people!
            </div>
          `}
        </section>
        <section>
          <ctzn-button
            class="text-gray-600 text-sm font-semibold w-full"
            label="Create Community"
            @click=${this.onClickCreateCommunity}
          ></ctzn-button>
        </section>
      </div>
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderNoSession () {
    return html`
      <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
        <div>
          <h1>Welcome to the CTZN network</h1>
          <p>The hottest place to get your memes</p>
        </div>
      </div>
    `
  }

  renderWithSession () {
    return html`
      <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
        <div>
          <div class="grid grid-cols-composer gap-3.5">
            <img class="w-8 h-8 rounded-full object-cover mt-2" src="${AVATAR_URL(session.info.userId)}">
            ${this.isComposingPost ? html`
              <ctzn-composer
                @publish=${this.onPublishPost}
                @cancel=${this.onCancelPost}
              ></ctzn-composer>
            ` : html`
              <div class="border border-solid border-gray-300 py-4 px-5 rounded cursor-text" @click=${this.onComposePost}>
                What's new?
              </div>
            `}
          </div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <div class="reload-page mx-4 mb-4 rounded cursor-pointer overflow-hidden leading-10 ${this.numNewItems > 0 ? 'expanded' : ''}" @click=${e => this.load()}>
            ${this.numNewItems} new ${pluralize(this.numNewItems, 'update')}
          </div>
          <ctzn-feed
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
          ></ctzn-feed>
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderEmptyMessage () {
    if (this.searchQuery) {
      return html`
        <div class="empty">
            <div class="fas fa-search"></div>
          <div>No results found for "${this.searchQuery}"</div>
        </div>
      `
    }
    return html`
      <div class="empty">
        <div class="fas fa-stream"></div>
        <div>Subscribe to sites to see what's new</div>
      </div>
    `
  }

  // events
  // =

  onFeedLoadStateUpdated (e) {
    if (typeof e.detail?.isEmpty !== 'undefined') {
      this.isEmpty = e.detail.isEmpty
    }
    this.requestUpdate()
  }

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onComposePost (e) {
    this.isComposingPost = true
  }

  onCancelPost (e) {
    this.isComposingPost = false
  }

  onPublishPost (e) {
    this.isComposingPost = false
    toast.create('Post published', '', 10e3)
    this.load()
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  async onClickCreateCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    const res = await CreateCommunityPopup.create()
    console.log(res)
    window.location = `/${res.userId}`
  }
}

customElements.define('ctzn-app', CtznApp)
