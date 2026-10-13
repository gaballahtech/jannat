-- Owner login by username instead of email.
alter table owners rename column email to username;
