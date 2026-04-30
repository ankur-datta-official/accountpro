export function AuthFormHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
