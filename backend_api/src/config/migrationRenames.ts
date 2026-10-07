// Migration files that were renumbered to resolve duplicate numbers.
//
// 024, 025, 027 and 028 each appeared twice, so apply order fell out of an
// alphabetical accident rather than author intent. `schema_migrations` is keyed
// by filename, so without this map every database that already applied the old
// name would replay the file under its new name on the next boot.
//
// In each pair the file that stayed put is the one referenced by number from
// application code; the file that moved is dependency-free — nothing in
// migrations 029-040 reads the tables, columns or functions it touches — so
// running it later in a fresh database is equivalent.
//
// Lives in its own side-effect-free module so the duplicate-number guard test
// can import it without booting the Express app or the database pool.
export const RENAMED_MIGRATIONS: ReadonlyArray<readonly [oldName: string, newName: string]> = [
    ['024_grant_founder_admin.sql', '041_grant_founder_admin.sql'],
    ['025_cleanup_test_users.sql', '042_cleanup_test_users.sql'],
    ['027_notification_sends.sql', '043_notification_sends.sql'],
    ['028_widen_enum_check_helper.sql', '044_widen_enum_check_helper.sql'],
];
