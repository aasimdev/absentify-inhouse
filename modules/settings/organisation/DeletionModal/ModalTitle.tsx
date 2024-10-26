import { Dialog } from "@headlessui/react"

export const ModalTitle = (props: {
  firstTitle: string,
  secondTitle?: string
}) => {
  return(
    <div className=" py-8 border border-b-gray-300 dark:border-0">
    <Dialog.Title
      as="h3"
      className="text-lg font-medium leading-6 text-gray-900 text-center dark:text-gray-200"
    >
      {props.firstTitle}
    </Dialog.Title>
    {props.secondTitle && (
    <Dialog.Title
    as="h3"
    className="text-lg font-medium leading-6 text-gray-900 text-center dark:text-gray-200"
    >
      {props.secondTitle}
    </Dialog.Title>
    )}
    </div>
  )
}