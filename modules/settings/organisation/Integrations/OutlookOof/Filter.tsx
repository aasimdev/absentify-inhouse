import { Disclosure } from '@headlessui/react'
import { FunnelIcon } from '@heroicons/react/20/solid'
import useTranslation from "next-translate/useTranslation"
import { Department } from "@prisma/client"

type Props = {
  departaments: Department[];
  handleSelectDep: (curr: Department) => void;
  selectedDep: (dep: Department) => Department | undefined;
  clearDeps: () => void;
}
function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export default function Filter({departaments, handleSelectDep, selectedDep, clearDeps}: Props) {
  const { t } = useTranslation('users');
  return (
    <div className="">
      <Disclosure
        as="section"
        aria-labelledby="filter-heading"
        className="grid items-center border rounded-md border-gray-300"
      >
        <div className="relative col-start-1 row-start-1 py-2">
          <div className="mx-auto flex max-w-7xl space-x-6 divide-x divide-gray-200 px-4 text-sm sm:px-6 lg:px-8">
            <div>
              <Disclosure.Button className="group flex items-center font-medium text-gray-700">
                <FunnelIcon
                  className="mr-2 h-5 w-5 flex-none text-gray-400 group-hover:text-gray-500  dark:text-gray-200"
                  aria-hidden="true"
                />
                <span className=' dark:text-gray-200'>{t('filters')}</span>
              </Disclosure.Button>
            </div>
            <div className="pl-6">
              <button type="button" className="text-gray-500  dark:text-gray-200" 
                onClick={clearDeps}>
                {t('clear_all')}
              </button>
            </div>
          </div>
        </div>
        <Disclosure.Panel className="border-t border-gray-200 py-4">
          <div className="
            flex flex-col ml-4
           ">
            <div className="

            ">
              <fieldset>
                <legend className="block font-medium dark:text-gray-200">{t('departaments')}</legend>
                <div className="space-y-6 pt-6 sm:space-y-4 sm:pt-4">
                  {departaments.map((dep) => (
                    <div key={dep.id} className="flex items-center text-base sm:text-sm pr-4">
                      <input
                        id={dep.id}
                        name="departament"
                        defaultValue={dep.id}
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-teams_brand_600 focus:ring-teams_brand_500  dark:text-gray-200 dark:bg-teams_brand_tbody  dark:border-gray-200 dark:focus:ring-teams_brand_tbody dark:focus:bg-teams_brand_tbody"
                        onChange={() => {handleSelectDep(dep)}}
                        checked={!!selectedDep(dep)}
                      />
                      <label htmlFor={dep.id} className="ml-3 min-w-0 flex-1 text-gray-600  dark:text-gray-200">
                        {dep.name}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </Disclosure.Panel>
      </Disclosure>
    </div>
  )
}
