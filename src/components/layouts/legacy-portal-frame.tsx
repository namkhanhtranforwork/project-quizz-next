type LegacyPortalFrameProps = {
  title: string;
  src: string;
};

export function LegacyPortalFrame({ title, src }: LegacyPortalFrameProps) {
  return (
    <main className="legacy-portal">
      <iframe className="legacy-portal-frame" src={src} title={title} />
    </main>
  );
}
