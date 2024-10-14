import { useAbsentify } from '@components/AbsentifyContext';
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/outline';

const TeamsChatButton = (props: { emails: string[]; topic: string; message: string; label: string }) => {
  const { in_teams, teamsChatIsSupported } = useAbsentify();

  if (!in_teams) return null;
  if (!teamsChatIsSupported) return null;
  const emails = props.emails.filter((email) => email !== '');
  if (emails.length === 0) return null;
  return (
    <>
      <span className="-mr-4 ml-3">
        <ChatBubbleOvalLeftEllipsisIcon
          className=" h-5 w-5 text-teams_brand_foreground_bg group-hover:text-teams_brand_border_1"
          aria-hidden="true"
        />
      </span>
      <button
        style={{ width: '100%', height: '100%', top: 0, left: 0, paddingTop: '8px', paddingBottom: '8px' }}
        onClick={async () => {
          const { chat, app } = await import('@microsoft/teams-js');
          await app.initialize();
          const chatPromise = chat.openGroupChat({
            users: emails,
            topic: props.topic,
            message: props.message
          });
          chatPromise
            .then(() => {
              /* Successful operation */
            })
            .catch((error) => {
              console.log(error);
              /* Unsuccessful operation */
            });
        }}
        type="button"
      >
        {props.label}
      </button>
    </>
  );
};
export default TeamsChatButton;
