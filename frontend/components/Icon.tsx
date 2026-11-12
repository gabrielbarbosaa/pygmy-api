const PATHS: Record<string, React.ReactNode> = {
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  shield: (<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3" /></>),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  layers: (<><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  refresh: <path d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" />,
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  logout: <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />,
  check: <path d="m5 12 5 5 9-10" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  power: <path d="M12 3v9M6.5 6.5a8 8 0 1 0 11 0" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  code: <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />,
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export default function Icon({ name, className = "" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
