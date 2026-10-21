import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <p className="digital text-[40px] leading-none text-foreground">404</p>
      <h1 className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-foreground">Page not found</h1>
      <Link to="/" className="mt-6 inline-block text-base font-medium text-foreground underline decoration-1 underline-offset-4 hover:decoration-2">
        Back to meetings
      </Link>
    </div>
  )
}
