function LoadingBlock(props: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-white/8 ${props.className ?? ""}`} />;
}

export default function WorkspaceLoading() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <LoadingBlock className="h-80" />
        <LoadingBlock className="h-80" />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        <div className="space-y-3">
          <LoadingBlock className="h-8 w-48" />
          <LoadingBlock className="h-14" />
          <LoadingBlock className="h-14" />
          <LoadingBlock className="h-14" />
        </div>
      </section>
    </div>
  );
}
