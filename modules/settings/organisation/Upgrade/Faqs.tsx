import { MinusIcon } from '@heroicons/react/24/solid';
import useTranslation from 'next-translate/useTranslation';
import Link from 'next/link';
import React, { useState } from 'react';

const ITEMS = [
  { id: 1, visible: false, question: 'upgrade:question1', content: 'upgrade:answer1' },
  { id: 2, visible: false, question: 'upgrade:question2', content: 'upgrade:answer2' },
  { id: 3, visible: false, question: 'upgrade:question3', content: 'upgrade:answer3' },
  { id: 4, visible: false, question: 'upgrade:question4', content: 'upgrade:answer4' },
  { id: 5, visible: false, question: 'upgrade:question5', content: 'upgrade:answer5' },
  { id: 6, visible: false, question: 'upgrade:question6', content: 'upgrade:answer6' },
  { id: 7, visible: false, question: 'upgrade:question7', content: 'upgrade:answer7' },
  { id: 8, visible: false, question: 'upgrade:question8', content: 'upgrade:answer8' },
  { id: 9, visible: false, question: 'upgrade:question9', content: 'upgrade:answer9' },
  { id: 10, visible: false, question: 'upgrade:question10', content: 'upgrade:answer10' },
  { id: 11, visible: false, question: 'upgrade:question11', content: 'upgrade:answer11' },
  { id: 12, visible: false, question: 'upgrade:question12', content: 'upgrade:answer12' },
  { id: 13, visible: false, question: 'upgrade:question13', content: 'upgrade:answer13' }
];

export const Faqs = () => {
  const [items, setItems] = useState(ITEMS);
  const { t } = useTranslation('upgrade');

  const getLink = (id: number) => {
    switch (id) {
      case 8:
      case 5:
        return 'https://support.absentify.com';
      case 6:
        return 'https://status.absentify.com';
      case 10:
        return 'https://absentify.getrewardful.com/signup';
      default:
        return '#';
    }
  };

  return (
    <div className="space-y-5 p-8">
      <h1 className="font-bold text-xl">FAQs</h1>
      <ul role="list" className="space-y-8 pb-6">
        {items.map((item, i) => (
          <li key={item.id} className="shadow-[0_3px_10px_rgb(0,0,0,0.1)] overflow-hidden rounded-md cursor-pointer">
            {!item.visible && (
              <div
                className="flex justify-between px-6 py-8 bg-white"
                onClick={() => {
                  const newItems = items.map((newItem, j) => ({
                    ...newItem,
                    visible: i === j ? true : newItem.visible
                  }));
                  setItems(newItems);
                }}
              >
                <p className="font-bold">{t(item.question)}</p>
                <span>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </span>
              </div>
            )}
            {item.visible && (
              <div
                className="flex flex-col px-6 py-8 bg-white"
                onClick={() => {
                  const newItems = items.map((newItem, j) => ({
                    ...newItem,
                    visible: i === j ? false : newItem.visible
                  }));
                  setItems(newItems);
                }}
              >
                <div className="flex justify-between pb-4">
                  <p className="font-bold">{t(item.question)}</p>
                  <span>
                    <MinusIcon className="w-6 h-6" />
                  </span>
                </div>
                <div
                  className={`${
                    item.id === 8
                      ? 'hover:text-teams_brand_foreground_bg underline'
                      : [5, 6].includes(item.id)
                      ? 'hover:text-teams_brand_foreground_bg'
                      : ''
                  } text-gray-400 text-sm`}
                >
                  {getLink(item.id) === '#' ? (
                    <span>{t(item.content)}</span>
                  ) : (
                    <Link href={getLink(item.id)}>{t(item.content)}</Link>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
