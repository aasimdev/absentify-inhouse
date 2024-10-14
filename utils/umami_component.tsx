import { useEffect } from 'react';

const UmamiScript = () => {
  useEffect(() => {
    let umami_website_id = '011cf372-e85d-4cc2-b7b3-1b81a42c9d1b';

    if (typeof window !== 'undefined') {
      const host = window.location.host;
      if (host.includes('teams.absentify.com')) {
        umami_website_id = '668166f8-1863-4ba1-8539-314a5f8402c7';
      } else if (host.includes('sharepoint.absentify.com')) {
        umami_website_id = '1fd37eb3-4a06-4383-96e1-de12e9a8e4cb';
      }
      
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = "/stats/script.js";
      script.setAttribute('data-website-id', umami_website_id);
      
      document.head.appendChild(script);

      // Optional: Entfernen des Skripts beim Clean-up
      return () => {
        document.head.removeChild(script);
      };
    }
  }, []); // Leeres Dependency-Array, um das Skript nur beim ersten Laden hinzuzufügen

  return null; // Da nichts gerendert wird
};

export default UmamiScript;
