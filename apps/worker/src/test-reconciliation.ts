import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import { processBillingReconciliation } from "./services/billingReconciliation.js";
import prisma from "./db/prisma.js";

const run = async () => {
  console.log("Starting manual trigger of the reconciliation job...");
  
  try {
    await processBillingReconciliation();
    console.log("Job completed successfully!");
  } catch (error) {
    console.error("Job failed with error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

run();
