import { useAbsentify } from '@components/AbsentifyContext';

const TeamsChatButton = (props: { emails: string[]; topic: string; message: string; label: string }) => {
  const { in_teams, teamsChatIsSupported } = useAbsentify();

  if (!in_teams) return null;
  if (!teamsChatIsSupported) return null;
  const emails = props.emails.filter((email) => email !== '');
  if (emails.length === 0) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const { chat, app } = await import('@microsoft/teams-js');
        await app.initialize();
        const chatPromise = chat.openGroupChat({ users: emails, topic: props.topic, message: props.message });
        chatPromise
          .then(() => {
            /*Successful operation*/
          })
          .catch((error) => {
            console.log(error);
            /*Unsuccessful operation*/
          });
      }}
      className="ml-5 bg-white py-2 px-3 border border-teams_brand_border_1 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50  flex order-last md:order-none w-32"
    >
      <p className="text-center mx-auto">{props.label}</p>
    </button>
  );
};
export default TeamsChatButton;
