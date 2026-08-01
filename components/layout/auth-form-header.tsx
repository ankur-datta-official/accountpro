export function AuthFormHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6 space-y-2">
      <h1 className="text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">{title}</h1>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
