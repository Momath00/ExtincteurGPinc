import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer style={{ background: '#0f172a' }} className="text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <img src="/logo.svg" alt="Extincteurs Nationex" className="h-9 w-auto" />
              <span className="text-base font-bold text-white leading-tight">
                Extincteurs Nationex
              </span>
            </Link>
            <p className="text-white/50 text-sm leading-relaxed">
              Gestion des rapports de vérification et certificats d'extincteurs portatifs.
            </p>
            <a href="mailto:service@nationex.net"
              className="text-[#dc2626] text-sm mt-3 block hover:underline">
              service@nationex.net
            </a>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Plateforme</h4>
            <ul className="space-y-2.5">
              <li><Link href="/#fonctionnalites" className="text-sm text-white/60 hover:text-white transition-colors">Fonctionnalités</Link></li>
              <li><Link href="/#a-propos" className="text-sm text-white/60 hover:text-white transition-colors">À propos</Link></li>
              <li><Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">Se connecter</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Entreprise</h4>
            <ul className="space-y-2.5">
              <li><Link href="/#contact" className="text-sm text-white/60 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/aide" className="text-sm text-white/60 hover:text-white transition-colors">Centre d'aide</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Légal</h4>
            <ul className="space-y-2.5">
              <li><Link href="/confidentialite" className="text-sm text-white/60 hover:text-white transition-colors">Confidentialité</Link></li>
              <li><Link href="/conditions" className="text-sm text-white/60 hover:text-white transition-colors">Conditions d'utilisation</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Extincteurs Nationex. Tous droits réservés.
          </p>
          <a href="tel:+15140000000" className="text-white/40 text-xs hover:text-white/70 transition-colors">
            514-000-0000
          </a>
        </div>
      </div>
    </footer>
  )
}