-- AlterTable
ALTER TABLE `allowancetype` ADD COLUMN `carry_forward_deadline` DATETIME(3) NULL DEFAULT '1970-12-31T00:00:00+00:00';
