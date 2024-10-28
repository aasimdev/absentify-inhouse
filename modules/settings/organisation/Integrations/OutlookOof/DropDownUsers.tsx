import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { classNames } from "~/lib/classNames"
import { Department, Member } from "@prisma/client"
import { useEffect, useRef, useState } from "react";
import useDebounce from "~/helper/useDebounce";
import useTranslation from 'next-translate/useTranslation';
import Filter from "./Filter";
import { defaultMemberSelectOutput } from '~/server/api/routers/member';
import { useDarkSide } from '@components/ThemeContext';
type Props = {
  members: defaultMemberSelectOutput[];
  handleSelect: (value: defaultMemberSelectOutput) => void;
  selectedMembers: (member: defaultMemberSelectOutput) => Partial<Member> | undefined;
  departaments: Department[];
  handleSelectOrClearAll: () => void;
  membersSelected: boolean;
  handleSelectedIndexDeps: (selectedDeps: Department[]) => void;
}

export default function DropDownUsers({members, handleSelect, selectedMembers, departaments, handleSelectOrClearAll, membersSelected, handleSelectedIndexDeps}: Props) {
  const [theme] = useDarkSide();
  const { t } = useTranslation('users');
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string | undefined>('');
  const [selectedDeps, setSelectedDeps] = useState<Department[]>([]);
  const debouncedSearchTerm: string = useDebounce<string>(search as string, 500);
  let filteredMembers: defaultMemberSelectOutput[] = [];
  if (selectedDeps.length > 0) {
    const selectedIds = selectedDeps.map(sel => sel.id);
    const initialMembers: defaultMemberSelectOutput[] = members?.filter(member => member.departments.find(dep => selectedIds.includes(dep.department_id)));
    filteredMembers = initialMembers?.filter((x) => {
      const member = x.name?.toLocaleLowerCase();
      if (!member) return false;
      if (debouncedSearchTerm) {
        return member.indexOf(debouncedSearchTerm) > -1;
      } else return true;
    });
  } else {
    filteredMembers = members?.filter((x) => {
      const member = x.name?.toLocaleLowerCase();
      if (!member) return false;
      if (debouncedSearchTerm) {
        return member.indexOf(debouncedSearchTerm) > -1;
      } else return true;
    });
  }
  const searchHandler = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchRef.current?.value?.toLowerCase());
  };

  const selectedDep = (depar: Department) => selectedDeps.find(dep => dep.id === depar.id);
  const handleSelectDep = (curr: Department) => {
    const selectedOne = selectedDep(curr);
    if(selectedOne) {
      setSelectedDeps((prev) => [...prev.filter(mem => mem.id !== selectedOne.id)])
      return;
    }
    setSelectedDeps((prev) => [...prev, curr])
  }

  const clearDeps = () => {
    setSelectedDeps([]);
  }
  useEffect(() => {
  if (selectedDeps.length > 0) {
    handleSelectedIndexDeps(selectedDeps);
  } else {
    handleSelectedIndexDeps([]);
  }
  },[selectedDeps])


  return (
    <>
        <div className="flex sm:flex-row flex-col items-start">
          <div className=" sm:mb-0 mb-4 sm:mr-4">
          <Filter departaments={departaments} handleSelectDep={handleSelectDep} selectedDep={selectedDep} clearDeps={clearDeps}/>
          </div>
            <div className="min-w-0 flex-1 md:px-8 lg:px-0 xl:col-span-6">
          <div className="flex items-center px-0 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
            <div className="w-full">
              <label htmlFor="search" className="sr-only  dark:text-gray-200">
                {t('search')}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="search"
                  name="search"
                  className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-teams_brand_500 focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teams_brand_500 sm:text-sm dark:bg-teams_brand_dark_100  dark:text-gray-200"
                  placeholder={t('search')}
                  type="search"
                  ref={searchRef}
                  onChange={searchHandler}
                />
              </div>
            </div>
          </div>
        </div>
        </div>
        <div className="mt-6 flex flex-col ">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-6 ">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-6">
              <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500">
                  <thead className="bg-gray-50 dark:bg-teams_brand_dark_100">
                    <tr>
                    <th
                        scope="col"
                        className={`min-w-20 w-32 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:w-40   dark:text-gray-200`}
                      >
                      <input
                            id="outOffOfficEdit"
                            name="outOffOfficEdit"
                            type="checkbox"
                            checked={membersSelected}
                            onChange={handleSelectOrClearAll}
                            className="ml-3 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450  dark:text-gray-200 dark:bg-teams_brand_dark_100"
                          />
                      </th>
                      <th
                        scope="col"
                        className={`min-w-20 w-32 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 lg:w-40  dark:text-gray-200 `}
                      >
                        {t('name')}
                      </th>
                      <th
                        scope="col"
                        className="min-w-20 hidden w-32 px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell lg:w-40  dark:text-gray-200"
                      >
                        {t('department')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-teams_brand_dark_100 dark:divide-gray-500">
                    {filteredMembers.map((member) => (
                          <tr key={member.id}>
                            <td className=" w-1/12">
                            <input
                            id="outOffOfficEdit"
                            name="outOffOfficEdit"
                            type="checkbox"
                            checked={!!selectedMembers(member)}
                            onChange={() => {
                              handleSelect(member);
                            }}
                            className="ml-3 h-4 w-4 rounded border-gray-300 text-teams_brand_foreground_1 focus:ring-teams_brand_450  dark:text-gray-200"
                          />
                            </td>

                            <td className=" flex w-full flex-row whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-90  dark:text-gray-200">
                              {member.has_cdn_image ? (
                              <img src={`https://data.absentify.com/profile-pictures/${member.microsoft_user_id}_64x64.jpeg`} alt="" className="h-8 w-8 flex-shrink-0 rounded-full" />
                              ) : (
                                <span
                                className={classNames('inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100  dark:text-gray-200')}
                              >
                                <svg className="h-full w-full text-gray-300  dark:text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </span>
                              )}
                              <span className="min-w-24 ml-2 mt-2  w-32 truncate lg:w-40 cursor-pointer  dark:text-gray-200">
                                <span
                                  data-tooltip-id="member-tooltip"
                                  data-tooltip-content={member.name as string}
                                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                >
                                  {member.name}
                                </span>
                              </span>
                            </td>
                            <td className="hidden w-96 whitespace-nowrap px-3 py-4 text-sm text-gray-500 md:table-cell  dark:text-gray-200">
                              <span className="min-w-20  mt-2 w-32 truncate lg:w-40 cursor-pointer  dark:text-gray-200">
                                <span
                                  data-tooltip-id="member-tooltip"
                                  data-tooltip-content={
                                    member.departments?.map((x) => x.department?.name).join(', ')}
                                  data-tooltip-variant={theme === 'dark' ? 'dark' : 'light'}
                                >
                                  {member.departments?.length > 2
                                    ? member.departments?.length + ' ' + t('departments')
                                    : member.departments?.map((x) => x.department?.name).join(', ')}
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                  </table>
                  </div>
            </div>
          </div>
        </div>
  </>
  )
}