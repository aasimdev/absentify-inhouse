import { useAbsentify } from '@components/AbsentifyContext';
import { GiftIcon } from '@heroicons/react/24/outline';
import { classNames } from 'lib/classNames';
import useTranslation from 'next-translate/useTranslation';
import { memo, useEffect } from 'react';

const FrillComponent = (props: { frillSsoToken?: string }) => {
  const { in_teams } = useAbsentify();
  const { current_member } = useAbsentify();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (!current_member) return;
    // We need to keep a reference to the widget instance so we can cleanup
    // when the component unmounts
    let widget: FrillWidget;
    // Define our config. You can get the key from the Widget code snippet
    const config: FrillConfig = {
      key: current_member.is_admin ? 'cb14f7cf-33dd-4975-b50e-f5da2b5f31c9' : 'f318e741-7851-45a8-b398-05d3c45c42c1',
      ssoToken: props.frillSsoToken,
      callbacks: {
        // This will be called when the widget is loaded
        onReady: (frillWidget) => {
          widget = frillWidget;
        }
      }
    };

    // Let's check if the Frill script has already loaded
    if ('Frill' in window) {
      // If the Frill api is already available we can create the widget now
      widget = window.Frill.widget(config);
    } else {
      // If the Frill api hasn't been loaded, we need to add our config to the list.
      // When the api loads, it will create all widgets in the Frill_Config list and dispatch the
      // config.callbacks.onReady event for each
      // @ts-ignore
      window.Frill_Config = window.Frill_Config || [];
      // @ts-ignore
      window.Frill_Config.push(config);
    }

    // Return a cleanup method so we can remove the widget when the component unmounts
    return () => {
      // Check if there is an active widget
      if (widget) {
        // If there is a widget, destroy it, this will remove all event listeners and nodes added
        // to the DOM by the widget
        widget.destroy();
      }
      // We also need to remove our config from the list so it doesn't get initialised.
      // This would only happen if the had component mounted/unmounted before the Frill api
      // had a chance to load.
      if (window.Frill_Config) {
        window.Frill_Config = window.Frill_Config.filter((c) => c !== config);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current_member]);

  return (
    <>
      <button
        type="button"
        className={classNames(
          in_teams
            ? 'text-teams_dark_mode_menu_underline hover:text-teams_brand_500'
            : 'text-teams_brand_200 hover:bg-teams_brand_800 hover:text-white',
          'flex-shrink-0 rounded-full p-1 focus:bg-teams_brand_900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams_brand_900 '
        )}
      >
        <span className="sr-only">{t('View_notifications')}</span>
        <div className="frill-button relative flex h-6 w-6 items-center justify-center rounded-full">
          <GiftIcon className="h-6 w-6 " aria-hidden="true" />
        </div>
      </button>
    </>
  );
};

export default memo(FrillComponent);
