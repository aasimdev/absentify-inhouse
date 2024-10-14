import { classNames } from 'lib/classNames';

function tailwindWidthToPixels(tailwindWidth: string): number {
  return parseInt(tailwindWidth, 10) * 4;
}

function getImageSize(tailwindWidth: string): string {
  const pixels = tailwindWidthToPixels(tailwindWidth);

  if (pixels <= 32) {
    return '32x32';
  } else if (pixels <= 64) {
    return '64x64';
  } else if (pixels <= 128) {
    return '128x128';
  } else if (pixels <= 256) {
    return '256x256';
  } else {
    return '512x512';
  }
}

const ProfileImage = (props: {
  tailwindSize: string;
  member:
    | {
        has_cdn_image: boolean;
        microsoft_user_id: string | null;
      }
    | null
    | undefined;
  className?: string | null;
}) => {
  if (props.member?.has_cdn_image && props.member?.microsoft_user_id) {
    //[32, 64, 128, 256, 512] available sizes
    const imageSize = getImageSize(props.tailwindSize);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={classNames(`rounded-full  h-${props.tailwindSize} w-${props.tailwindSize}`, props.className ?? '')}
        src={`https://data.absentify.com/profile-pictures/${props.member.microsoft_user_id}_${imageSize}.jpeg`}
        alt=""
      />
    );
  }
  if (props.tailwindSize == '6')
    return (
      <span
        className={classNames('inline-block h-6 w-6 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
      >
        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>
    );
  if (props.tailwindSize == '8')
    return (
      <span
        className={classNames('inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
      >
        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>
    );

  if (props.tailwindSize == '10')
    return (
      <span
        className={classNames('inline-block h-10 w-10 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
      >
        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>
    );
  if (props.tailwindSize == '12')
    return (
      <span
        className={classNames('inline-block h-12 w-12 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
      >
        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>
    );
  if (props.tailwindSize == '40')
    return (
      <span
        className={classNames('inline-block h-40 w-40 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
      >
        <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>
    );

  return (
    <span
      className={classNames('inline-block h-40 w-40 overflow-hidden rounded-full bg-gray-100', props.className ?? '')}
    >
      <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    </span>
  );
};

export default ProfileImage;
