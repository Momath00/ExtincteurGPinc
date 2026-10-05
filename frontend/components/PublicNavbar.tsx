'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#a-propos', label: 'À propos' },
  { href: '#contact', label: 'Contact' },
]

export default function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? 'bg-[#e11324] border-[#e11324] shadow-sm' : 'bg-white border-gray-100'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img
            src="/logo.svg"
            alt="ExtincteurGPinc"
            className="w-auto h-9"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
          {NAV_LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`py-1 transition-colors ${
                scrolled ? 'text-white hover:text-white/70' : 'text-[#0a0b0d] hover:text-[#e11324]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className={`text-sm font-bold px-5 py-2.5 rounded-md transition-colors ${
              scrolled ? 'bg-[#0a0b0d] text-white hover:bg-black' : 'bg-[#e11324] text-white hover:bg-[#c01020]'
            }`}
          >
            Se connecter
          </Link>
        </div>

        <button
          className="md:hidden relative w-9 h-9 flex flex-col items-center justify-center gap-1.5"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? (
            <i className={`ti ti-x text-xl ${scrolled ? 'text-white' : 'text-[#0a0b0d]'}`} />
          ) : (
            <>
              <span className={`block w-6 h-0.5 ${scrolled ? 'bg-white' : 'bg-[#0a0b0d]'}`} />
              <span className={`block w-6 h-0.5 ${scrolled ? 'bg-white' : 'bg-[#0a0b0d]'}`} />
              <span className={`block w-6 h-0.5 ${scrolled ? 'bg-white' : 'bg-[#0a0b0d]'}`} />
            </>
          )}
        </button>
      </div>

      {open && (
        <div className={`md:hidden border-t ${scrolled ? 'bg-[#e11324] border-white/10' : 'bg-white border-gray-100'}`}>
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm font-bold border-b last:border-b-0 ${
                  scrolled ? 'text-white border-white/10' : 'text-[#0a0b0d] border-gray-100'
                }`}
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={`text-center text-sm font-bold rounded-md py-2.5 ${
                  scrolled ? 'bg-[#0a0b0d] text-white' : 'bg-[#e11324] text-white'
                }`}
              >
                Se connecter
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
