import type { Prisma } from "@prisma/client";

type ProjectDeletionClient = Prisma.TransactionClient;

export const deleteProjectGraph = async (
  tx: ProjectDeletionClient,
  projectId: string
) => {
  const errorIds = (
    await tx.error.findMany({
      where: { projectId },
      select: { id: true }
    })
  ).map((errorRecord) => errorRecord.id);

  if (errorIds.length) {
    await tx.alertDelivery.deleteMany({
      where: {
        OR: [{ projectId }, { errorId: { in: errorIds } }]
      }
    });
    await tx.errorAnalysis.deleteMany({
      where: { errorId: { in: errorIds } }
    });
    await tx.errorEvent.deleteMany({
      where: { errorId: { in: errorIds } }
    });
    await tx.error.deleteMany({
      where: { id: { in: errorIds } }
    });
  } else {
    await tx.alertDelivery.deleteMany({
      where: { projectId }
    });
  }

  await tx.alertRule.deleteMany({
    where: { projectId }
  });
  await tx.release.deleteMany({
    where: { projectId }
  });
  await tx.project.delete({
    where: { id: projectId }
  });
};
