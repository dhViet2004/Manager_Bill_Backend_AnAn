-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `photo_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_user_id_idx`(`user_id`),
    UNIQUE INDEX `customers_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `bank_name` VARCHAR(191) NOT NULL,
    `account_number` VARCHAR(191) NOT NULL,
    `account_holder` VARCHAR(191) NOT NULL,
    `qr_image` LONGTEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `card_holder_name` VARCHAR(191) NULL,
    `card_type` VARCHAR(191) NULL,
    `last_four_digits` VARCHAR(4) NULL,
    `collaborator_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `banks_user_id_idx`(`user_id`),
    UNIQUE INDEX `banks_user_id_name_last_four_digits_key`(`user_id`, `name`, `last_four_digits`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_machines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `fee_percent` DOUBLE NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pos_machines_user_id_idx`(`user_id`),
    UNIQUE INDEX `pos_machines_user_id_name_key`(`user_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merged_bills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `total_amount` DOUBLE NOT NULL,
    `total_fee_thu` DOUBLE NOT NULL,
    `total_tien_am` DOUBLE NOT NULL DEFAULT 0,
    `is_collected` BOOLEAN NOT NULL DEFAULT false,
    `timestamp` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `merged_bills_user_id_idx`(`user_id`),
    INDEX `merged_bills_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bills` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `service_type` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `total_amount` DOUBLE NOT NULL,
    `total_fee_thu` DOUBLE NOT NULL,
    `total_profit` DOUBLE NOT NULL,
    `total_bank_lai` DOUBLE NOT NULL DEFAULT 0,
    `total_tien_am` DOUBLE NOT NULL DEFAULT 0,
    `total_phi_phai_tra` DOUBLE NOT NULL DEFAULT 0,
    `is_collected` BOOLEAN NOT NULL DEFAULT false,
    `payment_type` VARCHAR(191) NULL,
    `payment_method` VARCHAR(191) NULL,
    `timestamp` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `merged_bill_id` INTEGER NULL,

    INDEX `bills_user_id_idx`(`user_id`),
    INDEX `bills_timestamp_idx`(`timestamp`),
    INDEX `bills_customer_id_idx`(`customer_id`),
    INDEX `bills_is_collected_idx`(`is_collected`),
    INDEX `bills_merged_bill_id_idx`(`merged_bill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_rows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_id` INTEGER NOT NULL,
    `row_uuid` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `swiped_amount` DOUBLE NULL,
    `fee_goc_percent` DOUBLE NOT NULL,
    `fee_thu_percent` DOUBLE NOT NULL,
    `row_note` VARCHAR(191) NULL,
    `bank_id` INTEGER NULL,
    `bank_name` VARCHAR(191) NULL,
    `payment_type` VARCHAR(191) NULL,
    `payment_method` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bill_rows_row_uuid_key`(`row_uuid`),
    INDEX `bill_rows_bill_id_idx`(`bill_id`),
    INDEX `bill_rows_bank_id_idx`(`bank_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_history_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_row_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `collection_history_entries_bill_row_id_idx`(`bill_row_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_history_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bill_row_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pos_history_entries_bill_row_id_idx`(`bill_row_id`),
    INDEX `pos_history_entries_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_settings` ADD CONSTRAINT `bank_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `banks` ADD CONSTRAINT `banks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_machines` ADD CONSTRAINT `pos_machines_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merged_bills` ADD CONSTRAINT `merged_bills_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merged_bills` ADD CONSTRAINT `merged_bills_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_merged_bill_id_fkey` FOREIGN KEY (`merged_bill_id`) REFERENCES `merged_bills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_rows` ADD CONSTRAINT `bill_rows_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_rows` ADD CONSTRAINT `bill_rows_bank_id_fkey` FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_history_entries` ADD CONSTRAINT `collection_history_entries_bill_row_id_fkey` FOREIGN KEY (`bill_row_id`) REFERENCES `bill_rows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_history_entries` ADD CONSTRAINT `pos_history_entries_bill_row_id_fkey` FOREIGN KEY (`bill_row_id`) REFERENCES `bill_rows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
