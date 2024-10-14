import Image from "next/legacy/image";
export default function Maintenance() {
  return (
    <div className="min-h-full bg-white py-16 px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="mx-auto max-w-max">
        <main className="sm:flex">
          <a href="https://absentify.com">
            <Image src="/logo.png" alt="absentify" width={50} height={50} quality={100} />
          </a>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">We'll be back.</h1>
              <p className="mt-1 text-base text-gray-500">
                We're busy updating absentify for you and will be back soon (30 Minutes).
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
