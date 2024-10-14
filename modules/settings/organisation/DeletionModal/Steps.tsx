export const Steps = (props: { page: number }) => {
  const steps = [
    { name: 'Step 1', page: 0 },
    { name: 'Step 2', page: 1 },
    { name: 'Step 3', page: 2 }
  ];
  return (
    <nav className="flex items-center justify-center" aria-label="Progress">
      <p className="text-sm font-medium">{`Step ${props.page + 1} of 3`}</p>
      <ol role="list" className="ml-8 flex items-center space-x-5">
        {steps.map((step) => (
          <li key={step.name}>
            {step.page < props.page ? (
              <div className="block h-2.5 w-2.5 rounded-full bg-teams_brand_600">
                <span className="sr-only">{step.name}</span>
              </div>
            ) : step.page === props.page ? (
              <div className="relative flex items-center justify-center" aria-current="step">
                <span className="absolute flex h-5 w-5 p-px" aria-hidden="true">
                  <span className="h-full w-full rounded-full bg-teams_brand_200" />
                </span>
                <span className="relative block h-2.5 w-2.5 rounded-full bg-teams_brand_600" aria-hidden="true" />
                <span className="sr-only">{step.name}</span>
              </div>
            ) : (
              <div className="block h-2.5 w-2.5 rounded-full bg-gray-200">
                <span className="sr-only">{step.name}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
