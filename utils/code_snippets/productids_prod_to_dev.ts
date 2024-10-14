import { prisma } from '~/server/db';

export async function updateSubscriptionPlanIds() {
  // Objekt, das die Zuordnungen von alten zu neuen Plan-IDs hält
  const planIdUpdates = {
    BASIC: {
      currentMonthly: '798296',
      newMonthly: '38107',
      currentYearly: '798297',
      newYearly: '38108'
    },
    BUSINESS: {
      currentMonthly: '776197',
      newMonthly: '30634',
      currentYearly: '776198',
      newYearly: '30648'
    },
    DEPARTMENT_ADDON: {
      currentMonthly: '776199',
      newMonthly: '30635',
      currentYearly: '776200',
      newYearly: '30649'
    },
    SHARED_OUTLOOK_CALENDAR_SYNC_ADDON: {
      currentMonthly: '776201',
      newMonthly: '30636',
      currentYearly: '776202',
      newYearly: '30650'
    },
    MANAGER_ADDON: {
      currentMonthly: '776203',
      newMonthly: '30637',
      currentYearly: '776204',
      newYearly: '30651'
    },
    REPRESENTATIVE_LOGIC_ADDON: {
      currentMonthly: '776205',
      newMonthly: '30638',
      currentYearly: '776206',
      newYearly: '30652'
    }
    // Fügen Sie hier weitere Pläne hinzu, falls notwendig
  };

  // Durchlaufen Sie jede Plan-ID und führen Sie das Update durch
  for (const planIds of Object.values(planIdUpdates)) {
    await prisma.subscription.updateMany({
      where: { subscription_plan_id: planIds.currentMonthly },
      data: { subscription_plan_id: planIds.newMonthly }
    });
    await prisma.subscription.updateMany({
      where: { subscription_plan_id: planIds.currentYearly },
      data: { subscription_plan_id: planIds.newYearly }
    });
  }

  console.log('Die Plan-IDs wurden erfolgreich aktualisiert.');
}

// Führen Sie die Funktion aus, um die Plan-IDs zu aktualisieren
updateSubscriptionPlanIds();
