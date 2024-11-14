import ProfileImage from '@components/layout/components/ProfileImage';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import { format } from 'date-fns';
import { classNames } from 'lib/classNames';
import _ from 'lodash';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { api } from '~/utils/api';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';

export const options = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
      position: 'top' as const
    },
    title: {
      display: false
    }
  }
};
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const UsersPage: NextPage = () => {
  const { data: all_members, refetch } = api.administration.last50.useQuery();

  const [tabs, setTabs] = useState<{ name: string; current: boolean }[]>([
    { name: 'Users', current: true },
    { name: 'Active Companys', current: false },
    { name: 'Paid Ads', current: false }
  ]);
  const { data: active_workspaces } = api.administration.active_workspaces.useQuery(undefined, {
    enabled: tabs.find((x) => x.name == 'Active Companys')?.current
  });
  const { data: last14Days, refetch: refetch2 } = api.administration.allLast14Days.useQuery();
  const { data: paidAdsSubscriptions } = api.administration.getPaidAdsStatitsik.useQuery(undefined, {
    enabled: tabs.find((x) => x.name == 'Paid Ads')?.current
  });
  const { data: users_count } = api.administration.all_count.useQuery();
  const { current_member } = useAbsentify();
  const router = useRouter();
  const [labels, setLabels] = useState<string[]>([]);
  const [dataset, setDateset] = useState<any>([]);
  const [workspaces, setWorkpsaces] = useState<any>([]);

  useEffect(() => {
    if (!last14Days) return;
    const result = _(last14Days.users).groupBy((x) => x.createdAt.toLocaleDateString());
    const x = result.value();

    const resultWorkspaces = _(last14Days.workspaces).groupBy((x) => x.createdAt.toLocaleDateString());

    setLabels(Object.keys(x));

    setWorkpsaces(resultWorkspaces.value());
    setDateset(x);
  }, [last14Days]);

  const data = {
    labels,
    datasets: [
      {
        data: labels.map((x) => workspaces[x]?.length),
        backgroundColor: 'rgba(53, 162, 235, 0.5)'
      },
      {
        data: labels.map((x) => dataset[x]?.length)
      }
    ]
  };
  const [productChartData, setProductChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Number of Subscriptions',
        data: [] as number[],
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  });
  const [hoverData, setHoverData] = useState<number[]>([]);
  const [companyChartData, setCompanyChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Number of Registered Companies',
        data: [] as number[],
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }
    ]
  });
  const [conversionData, setConversionData] = useState<number[]>([]);
  const [userCountData, setUserCountData] = useState<number[]>([]);
  useEffect(() => {
    const sortLabels = (labels: string[]) => {
      return labels.sort((a, b) => {
        const [yearA, quarterA] = a.split(' Q').map((str) => parseInt(str, 10));
        const [yearB, quarterB] = b.split(' Q').map((str) => parseInt(str, 10));
        if (yearA !== yearB) {
          //@ts-ignore
          return yearA - yearB;
        }
        //@ts-ignore
        return quarterA - quarterB;
      });
    };
    if (paidAdsSubscriptions) {
      // Gruppiere die Daten nach Jahr/Quartal, Produkt und Referrer und zähle die Abonnements und summiere die Mengen
      const groupedData = paidAdsSubscriptions.soldProducts.reduce((acc, ad) => {
        const date = new Date(ad.createdAt);
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const key = `${year} Q${quarter} - ${ad.referrer} - ${ad.product}`;
        if (!acc[key]) {
          acc[key] = { count: 0, quantitySum: 0 };
        }
        acc[key].count += 1;
        acc[key].quantitySum += ad.quantity;
        return acc;
      }, {} as { [key: string]: { count: number; quantitySum: number } });

      const labels = Object.keys(groupedData);
      const counts = Object.values(groupedData).map((item) => item.count);
      const quantities = Object.values(groupedData).map((item) => item.quantitySum);

      setProductChartData({
        labels,
        datasets: [
          {
            label: 'Number of Subscriptions',
            data: counts,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      });
      setHoverData(quantities); // Hover-Daten setzen
    }
    if (paidAdsSubscriptions) {
      const groupedCompanyData = paidAdsSubscriptions.companiesRegisteredWithAds.reduce((acc, company) => {
        const date = new Date(company.createdAt);
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const key = `${year} Q${quarter} - ${company.referrer}`;
        if (!acc[key]) {
          acc[key] = { count: 0, converted: 0, userCount: 0 };
        }
        acc[key].count += 1;
        acc[key].userCount += company.members.length;
        return acc;
      }, {} as { [key: string]: { count: number; converted: number; userCount: number } });

      // Überprüfe, ob ein Unternehmen konvertiert wurde (hat eine Subscription)
      paidAdsSubscriptions.soldProducts.forEach((soldProduct) => {
        const date = new Date(soldProduct.createdAt);
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const key = `${year} Q${quarter} - ${soldProduct.referrer}`;
        if (groupedCompanyData[key]) {
          groupedCompanyData[key].converted += 1;
        }
      });

      const companyLabels = sortLabels(Object.keys(groupedCompanyData));
      const companyCounts = companyLabels.map((label) => groupedCompanyData[label]?.count || 0);
      const conversions = companyLabels.map((label) => groupedCompanyData[label]?.converted || 0);
      const userCounts = companyLabels.map((label) => groupedCompanyData[label]?.userCount || 0);

      setCompanyChartData({
        labels: companyLabels,
        datasets: [
          {
            label: 'Number of Registered Companies',
            data: companyCounts,
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
          }
        ]
      });
      setConversionData(conversions);
      setUserCountData(userCounts);
    }
  }, [paidAdsSubscriptions]);
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });
  const { t } = useTranslation('start');
  return (
    <>
      <Head>
        <title>{`${t('Stats')} - absentify`}</title>
        <meta name="description" content="Stats - absentify" />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : '/favicon.ico'} />
      </Head>
      <form className="divide-y divide-gray-200 lg:col-span-9" action="#" method="POST">
        {/* Profile section */}
        <div className="px-4 py-6 sm:p-6 lg:pb-8">
          <div>
            <h2 className="text-lg font-medium leading-6 text-gray-900">Statistik</h2>
            <p className="mt-1 text-sm text-gray-500"></p>
          </div>
          <div className="mt-6 flex flex-col lg:flex-row">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <Bar options={options} data={data} />

              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="overflow-hidden border-b border-gray-200 shadow sm:rounded-lg">
                  Benutzer ingesamt: {users_count} <br />
                  <input
                    type="button"
                    value="Refresh"
                    onClick={() => {
                      void (async () => {
                        await refetch();
                        await refetch2();
                      })();
                    }}
                  />
                  <input
                    type="button"
                    value="Signout"
                    onClick={() => {
                      void (async () => {
                        location.href = location.origin + '/api/auth/signout';
                      })();
                    }}
                  />
                  <div className="px-4 sm:px-0">
                    <div className="sm:hidden">
                      <label htmlFor="question-tabs" className="sr-only">
                        Select a tab
                      </label>
                      <select
                        id="question-tabs"
                        className="block w-full rounded-md border-gray-300 text-base font-medium text-gray-900 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500"
                        defaultValue={tabs.find((tab) => tab.current)?.name}
                        onChange={(e) => {
                          setTabs(
                            tabs.map((tab) => ({
                              ...tab,
                              current: tab.name === e.target.value
                            }))
                          );
                        }}
                      >
                        {tabs.map((tab) => (
                          <option key={tab.name}>{tab.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="hidden sm:block">
                      <nav className="isolate flex divide-x divide-gray-200 rounded-lg shadow" aria-label="Tabs">
                        {tabs.map((tab, tabIdx) => (
                          <a
                            key={tab.name}
                            onClick={(r) => {
                              r.preventDefault();
                              setTabs(
                                tabs.map((x) => ({
                                  ...x,
                                  current: x.name === tab.name
                                }))
                              );
                            }}
                            aria-current={tab.current ? 'page' : undefined}
                            className={classNames(
                              tab.current ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
                              tabIdx === 0 ? 'rounded-l-lg' : '',
                              tabIdx === tabs.length - 1 ? 'rounded-r-lg' : '',
                              'group relative min-w-0 flex-1 overflow-hidden bg-white py-4 px-6 text-center text-sm font-medium hover:bg-gray-50 focus:z-10'
                            )}
                          >
                            <span>{tab.name}</span>
                            <span
                              aria-hidden="true"
                              className={classNames(
                                tab.current ? 'bg-teams_brand_500' : 'bg-transparent',
                                'absolute inset-x-0 bottom-0 h-0.5'
                              )}
                            />
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                  {tabs.find((x) => x.name == 'Users')?.current && (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-teams_brand_border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          ></th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            Email
                          </th>
                          <th
                            scope="col"
                            className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                          >
                            Datum
                          </th>
                          <th
                            scope="col"
                            className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                          >
                            Workspace Referrer
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {all_members?.map((member) => (
                          <tr
                            key={member.id}
                            className="cursor-pointer"
                            onClick={() => {
                              void (async () => {
                                await router.push(`/internal/users/?memberId=${member.id ?? ''}`);
                              })();
                            }}
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {<ProfileImage member={member} tailwindSize="8" />}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {member.email}
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 md:table-cell">
                              {current_member && format(member.createdAt, current_member.long_datetime_format)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {member.workspace.referrer}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {tabs.find((x) => x.name == 'Active Companys')?.current && (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-teams_brand_border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          ></th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                          >
                            Users
                          </th>
                          <th
                            scope="col"
                            className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                          >
                            Datum
                          </th>
                          <th
                            scope="col"
                            className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                          >
                            Aktivität (Signins/Requests)
                          </th>
                          <th
                            scope="col"
                            className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell"
                          >
                            Referrer
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {active_workspaces?.map((workspace) => (
                          <tr
                            key={workspace.workspaceId}
                            className="cursor-pointer"
                            onClick={() =>
                              void (async () => {
                                await router.push(`/internal/workspace/?workspaceId=${workspace.workspaceId}`);
                              })()
                            }
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {workspace.workspaceName} / {workspace.workspaceMembers[0]?.email?.split('@')[1]}{' '}
                              {workspace.workspaceSubscriptions.filter((x) => x.status == 'active').length > 0 && (
                                <span className="text-green-500">✔</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {workspace.workspaceMembers.length}
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 md:table-cell">
                              {current_member &&
                                format(workspace.workspaceCreatedAt, current_member.long_datetime_format)}
                            </td>
                            <td>
                              {workspace.activityLevel} ({workspace.totalSignins}/{workspace.totalRequests})
                            </td>
                            <td>{workspace.workspaceReferer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {tabs.find((x) => x.name == 'Paid Ads')?.current && (
                    <div>
                      <h2>Sold Products by Year/Quarter, Referrer and Product</h2>
                      <Bar
                        data={productChartData}
                        options={{
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1 // Hier die Schrittweite der y-Achse einstellen
                              }
                            }
                          },
                          plugins: {
                            tooltip: {
                              callbacks: {
                                // Tooltip anpassen, um die Summe der Quantity anzuzeigen
                                label: function (context) {
                                  const index = context.dataIndex;
                                  const label = context.dataset.label || '';
                                  const value = context.raw as number;
                                  const quantitySum = hoverData[index];
                                  return `${label}: ${value} (Total Quantity: ${quantitySum})`;
                                }
                              }
                            }
                          }
                        }}
                      />
                      <h2>Registered Companies by Year/Quarter and Referrer</h2>
                      <Bar
                        data={companyChartData}
                        options={{
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1 // Hier die Schrittweite der y-Achse einstellen
                              }
                            }
                          },
                          plugins: {
                            tooltip: {
                              callbacks: {
                                // Tooltip anpassen, um die Konvertierungen und Benutzeranzahl anzuzeigen
                                label: function (context) {
                                  const index = context.dataIndex;
                                  const label = context.dataset.label || '';
                                  const value = context.raw as number;
                                  const converted = conversionData[index];
                                  const userCount = userCountData[index];
                                  return `${label}: ${value} (Converted: ${converted}, Users: ${userCount})`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>{' '}
        </div>
      </form>
    </>
  );
};

export default UsersPage;
