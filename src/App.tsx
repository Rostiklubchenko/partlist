import { useState, useEffect, useCallback } from 'react'
import Catalog from './components/Catalog'
import PartDetail from './components/PartDetail'
import { CategoryIcon, IconArrow } from './components/Icons'
import { getAllFavs, favsCount, type FavEntry } from './favorites'
import { buildCount } from './builder'
import Builder from './components/Builder'
import type { Part, Category } from './types'
import type { Lang, Translations } from './i18n'
import { t } from './i18n'
import './app.css'

const CATEGORIES: Category[] = ['cpu', 'gpu', 'motherboard', 'ram', 'psu', 'storage']

type View = 'landing' | 'catalog' | 'detail' | 'favorites' | 'builder'

interface NavState {
  view: View
  category: Category
  part: Part | null
  catalogPage: number
  catalogSearch: string
  pickingSlot?: Category  // set when user is picking a part for the builder
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark'
  )
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem('lang') as Lang) ?? 'uk'
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [favCount, setFavCount] = useState(() => favsCount())
  const [buildSlots, setBuildSlots] = useState(() => buildCount())
  // ── History-aware navigation ─────────────────────────────────────────────
  function stateFromHash(): NavState {
    const hash = window.location.hash.slice(1) // remove #
    if (!hash) return { view: 'landing', category: 'cpu', part: null, catalogPage: 0, catalogSearch: '' }
    try {
      return JSON.parse(decodeURIComponent(hash)) as NavState
    } catch {
      return { view: 'landing', category: 'cpu', part: null, catalogPage: 0, catalogSearch: '' }
    }
  }

  const [nav, setNav] = useState<NavState>(stateFromHash)

  const tr = t[lang]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])

  // Keep favCount in sync whenever favorites change (from any component)
  useEffect(() => {
    const sync = () => setFavCount(favsCount())
    window.addEventListener('favs-updated', sync)
    return () => window.removeEventListener('favs-updated', sync)
  }, [])

  useEffect(() => {
    const syncBuild = () => setBuildSlots(buildCount())
    window.addEventListener('build-updated', syncBuild)
    return () => window.removeEventListener('build-updated', syncBuild)
  }, [])

  // Push a new nav state into browser history
  const pushNav = useCallback((next: NavState) => {
    const hash = encodeURIComponent(JSON.stringify(next))
    window.history.pushState(next, '', '#' + hash)
    setNav(next)
  }, [])

  // Listen to browser back/forward
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      if (e.state) {
        setNav(e.state as NavState)
      } else {
        setNav({ view: 'landing', category: 'cpu', part: null, catalogPage: 0, catalogSearch: '' })
      }
    }
    window.addEventListener('popstate', handler)
    // Replace current entry so first back goes to landing
    const initial = stateFromHash()
    window.history.replaceState(initial, '', window.location.hash || '#' + encodeURIComponent(JSON.stringify(initial)))
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function goToCategory(cat: Category) {
    pushNav({ view: 'catalog', category: cat, part: null, catalogPage: 0, catalogSearch: '' })
  }
  function goToDetail(part: Part) {
    setNav(n => {
      const next = { ...n, view: 'detail' as View, part }
      const hash = encodeURIComponent(JSON.stringify(next))
      window.history.pushState(next, '', '#' + hash)
      return next
    })
  }
  function refreshFavCount() { setFavCount(favsCount()) }
  function goToBuilder() {
    setNav(n => { const next = { ...n, view: 'builder' as View, pickingSlot: undefined }; const hash = encodeURIComponent(JSON.stringify(next)); window.history.pushState(next, '', '#' + hash); return next })
  }
  function goBackToCatalog() {
    window.history.back()
  }
  function goToFavorites() {
    setNav(n => {
      const next = { ...n, view: 'favorites' as View }
      const hash = encodeURIComponent(JSON.stringify(next))
      window.history.pushState(next, '', '#' + hash)
      return next
    })
  }
  function saveCatalogState(page: number, search: string) {
    setNav(n => ({ ...n, catalogPage: page, catalogSearch: search }))
  }

  return (
    <div className="app">
      <header className="navbar">
        <button className="nav-logo" onClick={() => pushNav({ view: 'landing', category: nav.category, part: null, catalogPage: 0, catalogSearch: '' })}>
          <span className="logo-bracket">[</span>
          <span className="logo-text">PARTLIST</span>
          <span className="logo-bracket">]</span>
        </button>

        {nav.view !== 'landing' && (
          <>
            <nav className="nav-cats">
              {CATEGORIES.map(id => (
                <button
                  key={id}
                  className={`nav-cat-pill${nav.category === id ? ' active' : ''}`}
                  onClick={() => goToCategory(id)}
                >
                  <CategoryIcon id={id} size={14} />
                  <span className="nav-cat-label">{tr[id]}</span>
                </button>
              ))}
            </nav>
            {/* Mobile burger */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileMenuOpen
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              }
            </button>
          </>
        )}

        <div className="nav-controls">
          <button
            className={`ctrl-btn nav-builder-btn${nav.view === 'builder' ? ' active' : ''}`}
            onClick={goToBuilder}
            title="PC Builder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            {buildSlots > 0 && <span className="nav-build-count">{buildSlots}</span>}
          </button>
          <button
            className={`ctrl-btn nav-fav-btn${nav.view === 'favorites' ? ' active' : ''}`}
            onClick={goToFavorites}
            title={tr.favorites}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={nav.view === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {favCount > 0 && <span className="nav-fav-count">{favCount}</span>}
          </button>
          <button className="ctrl-btn" onClick={() => setLang(l => l === 'uk' ? 'en' : 'uk')}>
            {lang === 'uk' ? 'EN' : 'УК'}
          </button>
          <button className="ctrl-btn theme-btn" onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        {nav.view === 'landing' && (
          <Landing tr={tr} categories={CATEGORIES} onSelect={goToCategory} />
        )}
        {nav.view === 'catalog' && (
          <Catalog
            category={nav.category}
            onCategoryChange={goToCategory}
            onSelectPart={goToDetail}
            initialPage={nav.catalogPage}
            initialSearch={nav.catalogSearch}
            onStateChange={saveCatalogState}
            tr={tr}
            pickingSlot={nav.pickingSlot}
          />
        )}
        {nav.view === 'builder' && (
          <Builder
            tr={tr}
            onSelectSlot={(cat) => {
              setNav(n => {
                const next = { ...n, view: 'catalog' as View, category: cat as Category, pickingSlot: cat as Category, catalogPage: 0, catalogSearch: '' }
                const hash = encodeURIComponent(JSON.stringify(next))
                window.history.pushState(next, '', '#' + hash)
                return next
              })
            }}
          />
        )}
        {nav.view === 'favorites' && (
          <Catalog
            category={nav.category}
            onCategoryChange={goToCategory}
            onSelectPart={goToDetail}
            initialPage={0}
            initialSearch=""
            onStateChange={saveCatalogState}
            tr={tr}
            favsMode={true}
            favParts={getAllFavs()}
          />
        )}
        {nav.view === 'detail' && nav.part && (
          <PartDetail
            part={nav.part}
            category={nav.category}
            onBack={goBackToCatalog}
            tr={tr}
          />
        )}
      </main>

      {/* Mobile category drawer */}
      {mobileMenuOpen && nav.view !== 'landing' && (
        <div className="mobile-drawer" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-inner" onClick={e => e.stopPropagation()}>
            {CATEGORIES.map(id => (
              <button
                key={id}
                className={`mobile-drawer-item${nav.category === id ? ' active' : ''}`}
                onClick={() => { goToCategory(id); setMobileMenuOpen(false) }}
              >
                <CategoryIcon id={id} size={18} />
                <span>{tr[id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <footer className="app-footer">
        <span className="footer-logo">[PARTLIST]</span>
        <span className="footer-sep">·</span>
        <span className="footer-desc">{tr.footerDesc}</span>
        <span className="footer-sep">·</span>
        <span className="footer-note">{tr.footerNote}</span>

        <ClearCacheBtn tr={tr} />
      </footer>
    </div>
  )
}

function Landing({ tr, categories, onSelect }: {
  tr: Translations
  categories: Category[]
  onSelect: (c: Category) => void
}) {
  return (
    <div className="landing">
      <div className="landing-bg-grid" aria-hidden="true" />
      <div className="landing-glow" aria-hidden="true" />

      <div className="landing-hero">
        <h1 className="landing-title">{tr.landingTitle}</h1>
        <p className="landing-sub">{tr.landingSub}</p>
        <div className="landing-stats">
          <div className="stat">
            <span className="stat-num">15K+</span>
            <span className="stat-label">{tr.statParts}</span>
          </div>
          <div className="stat-div" />
          <div className="stat">
            <span className="stat-num">6</span>
            <span className="stat-label">{tr.statCategories}</span>
          </div>
        </div>
      </div>

      <div className="landing-grid">
        {categories.map((id, i) => (
          <button
            key={id}
            className="landing-card"
            onClick={() => onSelect(id)}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="landing-card-top">
              <CategoryIcon id={id} size={22} className="landing-card-icon" />
              <IconArrow size={16} className="landing-card-arrow" />
            </div>
            <span className="landing-card-label">{tr[id]}</span>
            <div className="landing-card-shine" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ClearCacheBtn({ tr: _tr }: { tr: Translations }) {
  const [done, setDone] = useState(false)

  function clear() {
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('partlist_')
    )
    keys.forEach(k => localStorage.removeItem(k))
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <button className="clear-cache-btn" onClick={clear}>
      {done ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Cleared
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          Clear cache
        </>
      )}
    </button>
  )
}