import { Fragment, useState, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import ProfileImage from '@components/layout/components/ProfileImage';
import { defaultMemberSelectOutput } from '~/server/api/routers/member';

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}
type Props = {
  members: defaultMemberSelectOutput[];
  handleTestingMember: Function;
};
export default function DropDownSelectMember({ members, handleTestingMember }: Props) {
  const [selected, setSelected] = useState(members[0]);

  useEffect(() => {
    handleTestingMember(selected);
  }, [selected]);

  return (
    <Listbox value={selected} onChange={setSelected}>
      {({ open }) => (
        <>
          <div className="relative mt-2">
            <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-teams_brand_500 sm:text-sm sm:leading-6">
              <div className="flex items-center">
                <ProfileImage tailwindSize="6" member={selected} />
                <span className="ml-3 block truncate  dark:text-gray-200">{selected?.name}</span>
              </div>
              <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400  dark:text-gray-200" aria-hidden="true" />
              </span>
            </Listbox.Button>

            <Transition
              show={open}
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm dark:bg-teams_brand_dark_100  dark:text-gray-200">
                {members.map((member) => (
                  <Listbox.Option
                    key={member.id}
                    className={({ active }) =>
                      classNames(
                        active ? 'bg-teams_brand_600 text-white' : 'text-gray-900',
                        'relative cursor-default select-none py-2 pl-3 pr-9'
                      )
                    }
                    value={member}
                  >
                    {({ selected, active }) => (
                      <>
                        <div className="flex items-center">
                        <ProfileImage tailwindSize="6" member={member} />
                          <span
                            className={classNames(selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate  dark:text-gray-200')}
                          >
                            {member.name}
                          </span>
                        </div>

                        {selected ? (
                          <span
                            className={classNames(
                              active ? 'text-white' : 'text-teams_brand_600',
                              'absolute inset-y-0 right-0 flex items-center pr-4  dark:text-gray-200'
                            )}
                          >
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </>
      )}
    </Listbox>
  );
}
