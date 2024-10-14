export const ModalTextArea = (props: {
  handleReasonText: (value: string) => void;
  text: string;
  row: number;
}) => {
  return(
    <div className="mt-2">
    <textarea
      onChange={(e) => {
        props.handleReasonText(e.target.value);
      }}
      id="reason"
      placeholder={props.text}
      name="reason"
      maxLength={2500}
      rows={props.row}
      className="block w-full max-w-lg rounded-md border border-gray-300 shadow-sm focus:border-teams_brand_500 focus:ring-teams_brand_500 sm:text-sm"
      defaultValue={''}
    />
  </div>
  )
}