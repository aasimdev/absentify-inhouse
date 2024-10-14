function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

type Props = {
  tabs: {id: number, name: string}[];
  handler: (value: number) => void;
  selectedTab: number;
}

export default function OofTabs({tabs, handler, selectedTab}: Props) {
  return (
    <div>
      <div className="">
        <nav className="isolate flex divide-x divide-gray-300 shadow" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {handler(tab.id)}}
              className={classNames(
                selectedTab === tab.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
                'group relative min-w-0 flex-1 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-gray-50 focus:z-10'
              )}
              aria-current={selectedTab === tab.id ? 'page' : undefined}
            >
              <span>{tab.name}</span>
              <span
                aria-hidden="true"
                className={classNames(
                  selectedTab === tab.id ? 'bg-[#6264a7]' : 'bg-transparent',
                  'absolute inset-x-0 bottom-0 h-0.5'
                )}
              />
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
