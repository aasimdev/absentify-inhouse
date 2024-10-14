function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

type Props = {
  tabs: {id: number, name: string}[],
  handler: (value: boolean) => void;
  showArchived: boolean;
}

export default function TabsUsers({tabs, handler, showArchived}: Props) {
  const showArchivedId = showArchived ? 2 : 1;
  return (
    <div>
      <div className="block">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            {tabs.map((tab) => (
              <a
                key={tab.name}
                href="#"
                onClick={() => {handler(tab.id === 2)}}
                className={classNames(
                  tab.id === showArchivedId
                    ? 'border-[#6264a7] text-[#6264a7]'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  'w-1/4 border-b-2 py-4 px-1 text-center text-sm font-medium'
                )}
                aria-current={tab.id === showArchivedId ? 'page' : undefined}
              >
                {tab.name}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

