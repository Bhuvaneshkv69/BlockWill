-- DropForeignKey
ALTER TABLE "InheritanceDistribution" DROP CONSTRAINT "InheritanceDistribution_beneficiaryId_fkey";

-- AddForeignKey
ALTER TABLE "InheritanceDistribution" ADD CONSTRAINT "InheritanceDistribution_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
