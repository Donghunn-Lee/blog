import siteMetadata from '@/data/siteMetadata'
import headerNavLinks from '@/data/headerNavLinks'
import Image from './Image'
import Link from './Link'
import MobileNav from './MobileNav'
import ThemeSwitch from './ThemeSwitch'
import SearchButton from './SearchButton'
import SocialIcon from './social-icons'

const Header = () => {
  let headerClass = 'flex items-center w-full bg-white dark:bg-gray-800 justify-between py-10'
  if (siteMetadata.stickyNav) {
    headerClass += ' sticky top-0 z-50'
  }

  return (
    <header className={headerClass}>
      <Link href="/" aria-label={siteMetadata.headerTitle} className="flex items-center">
        <Image
          src="/static/images/logo.png"
          alt=""
          width={32}
          height={32}
          className="mr-3 h-8 w-8"
          priority
        />
        {typeof siteMetadata.headerTitle === 'string' ? (
          <div className="text-2xl font-semibold">{siteMetadata.headerTitle}</div>
        ) : (
          siteMetadata.headerTitle
        )}
      </Link>
      <div className="flex items-center space-x-4 leading-5 sm:-mr-6 sm:space-x-6">
        <div className="no-scrollbar hidden items-center gap-x-4 overflow-x-auto sm:flex">
          {headerNavLinks
            .filter((link) => link.href !== '/')
            .map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="hover:text-primary-500 dark:hover:text-primary-400 m-1 font-medium text-gray-900 dark:text-gray-100"
              >
                {link.title}
              </Link>
            ))}
        </div>
        <SearchButton />
        {/* No room next to the title on phones, so these move into MobileNav there */}
        <div className="hidden items-center space-x-6 sm:flex">
          <span aria-hidden="true" className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          <SocialIcon kind="mail" href={`mailto:${siteMetadata.email}`} size={6} />
          <SocialIcon kind="github" href={siteMetadata.github} size={6} />
        </div>
        <ThemeSwitch />
        <MobileNav />
      </div>
    </header>
  )
}

export default Header
