import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { api } from '~/utils/api';
import Select from 'react-select';
import { useAbsentify } from '@components/AbsentifyContext';
import useTranslation from 'next-translate/useTranslation';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
const TeamsTabConfig: NextPage = () => {
  const { theme } = useAbsentify();
  const onClient = typeof window !== 'undefined';
  const { t } = useTranslation('microsoft_tab_config');
  const { data: departments } = api.department.all.useQuery(undefined, {
    staleTime: 60000
  });
  const [departmentDropDownValues, setDepartmentDropDownValues] = useState<{ id: string; name: string }[]>();
  const {
    formState: { errors },
    control,
    setValue,
    watch,
    getValues
  } = useForm<{ department: { id: string; name: string }; tabName: string }>();

  const onSubmit: SubmitHandler<{ department: { id: string; name: string }; tabName: string }> = async (
    data: { department: { id: string; name: string }; tabName: string }
  ) => {
    if(data.department && data.tabName){
    if (!onClient) return;
    const { app, pages } = await import('@microsoft/teams-js');
    await app.initialize();
   


      pages.config.registerOnSaveHandler(async (saveEvent) => {
        await pages.config.setConfig({
          suggestedDisplayName: data.tabName,
          entityId: 'Test',
          contentUrl: 'https://teams.absentify.com?department_id=' + data.department.id,
          websiteUrl: 'https://app.absentify.com?department_id=' + data.department.id
        });
        saveEvent.notifySuccess();
      });
      /**
       * After verifying that the settings for your tab are correctly
       * filled in by the user you need to set the state of the dialog
       * to be valid.  This will enable the save button in the configuration
       * dialog.
       */
        pages.config.setValidityState(true)
    }        
  };
  const { data: workspace } = api.workspace.current.useQuery(undefined, { staleTime: 60000 });

  useEffect(() => {
    if (!departments) return;
    const DEPARTMENTDROPDOWNVALUE = [{ id: '1', name: t('All_departments') }];
    for (let index = 0; index < departments.length; index += 1) {
      const department = departments[index];
      if (department)
        DEPARTMENTDROPDOWNVALUE.push({
          id: department.id,
          name: department.name
        });
    }
    setDepartmentDropDownValues(DEPARTMENTDROPDOWNVALUE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments]);

  useEffect(() => {
      onSubmit({ department: getValues('department'), tabName: getValues('tabName') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch('department'), watch('tabName')]);

  return (
    <>
      <Head>
        <title>{`${t('tab_config')} - absentify`}</title>
        <meta name="description" content={t('tab_config') + ' - absentify'} />
        <link rel="icon" href={workspace?.favicon_url ? workspace?.favicon_url : "/favicon.ico"} />
      </Head>
      <form>
        <div className="p-8 text-sm ">
          <h1 className={`${theme == 'light' ? 'text-black' : 'text-white'}`}>{t('title')}</h1>
          <br />
          <h2 className={`${theme == 'light' ? 'text-black' : 'text-white'}`}>{t('choose_department')}</h2>

          <div className="py-8 text-sm">
            {/* This is where you will add your tab configuration options the user can
          choose when the tab is added to your team/group chat. */}
            {departmentDropDownValues && (
              <Controller
                rules={{ required: true }}
                control={control}
                name="department"
                render={({ field: { onChange } }) => (
                  <Select
                    styles={{
                      menu: (base) => ({
                        ...base,
                        background: theme == 'light' ? 'white' : '#2d2c2c'
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: theme == 'light' ? 'black' : 'white'
                      }),
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: theme == 'light' ? (state.isFocused ? '#f3f2f1' : '#Eceae9') : 'black',
                        color: theme == 'light' ? 'red' : 'white',
                        borderColor: theme == 'light' ? '#f3f2f1' : 'black',
                        fontSize: 'bold',
                        '*': {
                          boxShadow: 'none !important'
                        }
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor:
                          theme == 'light'
                            ? state.isFocused
                              ? '#f3f2f1'
                              : state.isSelected
                              ? 'white'
                              : 'transparent'
                            : state.isFocused
                            ? '#3b3a39'
                            : 'transparent',
                        color: theme == 'light' ? (state.isSelected ? 'gray' : 'black') : 'white',
                        height: '100%'
                      })
                    }}
                    defaultValue={departmentDropDownValues[0]}
                    getOptionLabel={(option) => `${option.name}`}
                    getOptionValue={(option) => option.id}
                    options={departmentDropDownValues}
                    theme={(theme) => ({
                      ...theme,
                      borderRadius: 2,
                      colors: {
                        ...theme.colors,
                        primary25: 'neutral20',
                        primary: 'neutral15'
                      }
                    })}
                    onChange={(val) => {
                      if (val) {
                        onChange(val);
                        setValue('tabName', t('suggestedTabName', { suggestedTabName: val.name }))
                      }
                    }}
                  />
                )}
              ></Controller>
            )}
          </div>
          <h2 className={`${theme == 'light' ? 'text-black' : 'text-white'}`}>{t('tab_name')}</h2>
          <br />
          <Controller
            rules={{ required: true }}
            control={control}
            name="tabName"
            render={({ field: { onChange, value } }) => (
              <input
                className={`w-full text-sm border-transparent ${
                  theme == 'light'
                    ? 'bg-[#Eceae9] focus:bg-[#f3f2f1] text-black'
                    : ' bg-black focus:bg-black text-white '
                } hover:border-gray-400 rounded-sm focus:border-transparent focus:ring-0  `}
                type="text"
                defaultValue={t('suggestedTabName', { suggestedTabName: t('All_departments') })}
                value={value}
                onChange={(val) => {
                  onChange(val);
                }}
              />
            )}
          ></Controller>
        </div>
      </form>
    </>
  );
};

export default TeamsTabConfig;
