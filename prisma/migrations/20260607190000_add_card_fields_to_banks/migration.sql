ALTER TABLE `banks`
  ADD COLUMN `card_holder_name` VARCHAR(191) NULL,
  ADD COLUMN `card_type` VARCHAR(191) NULL,
  ADD COLUMN `last_four_digits` VARCHAR(4) NULL,
  ADD COLUMN `pos_machine_name` VARCHAR(191) NULL,
  ADD COLUMN `collaborator_name` VARCHAR(191) NULL;

DROP INDEX `banks_user_id_name_key` ON `banks`;

CREATE UNIQUE INDEX `banks_user_id_name_last_four_digits_key`
  ON `banks`(`user_id`, `name`, `last_four_digits`);
