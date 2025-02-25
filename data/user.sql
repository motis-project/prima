INSERT INTO "user" ("email", "is_taxi_owner", "is_admin", "password_hash", "name", "phone", "company_id", "is_email_verified") VALUES
('foo@bar.de',	'f',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$9fW6tfdNBJHtNC/RgNpMgg$z+hlFH7KXxKbIyt1q4fTK134FYcF8y10ZjSslzyqmFc',	'John',	'0815-1231234',	NULL, 't'),
('maintainer@zvon.de',	'f',	't',	'$argon2id$v=19$m=19456,t=2,p=1$ZtuiFUoQYRyXUQRduYBkfQ$E+aREm5wKl8Ldn5ASP3wZnPf/jRriMIQmR3L3BhDaSA',	'John',	NULL,	NULL, 't'),
('taxi@weisswasser.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$BoC0z8dXsKPZmUMvpnRXPw$Hc6rK5wlUNizsw5GQFjJ9oQ9uMhgWln42Ak4J2rO8yc',	'John',	NULL,	1, 't'),
('taxi@gablenz.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$3/CML3alHoFB7kYR3Fz9Hw$qQ7MYo7N6NO0SeCKXFs4VrPdiwGAT0FhE5KmwC0fv8U',	'John',	NULL,	2, 't'),
('taxi@reichwalde.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$UCIZz8oGzu9kCDOpmWXxYQ$amyxen1cjPmi/TwetOz7I/f+neLvlx6eQxM6OTvIzx0',	'John',	NULL,	3, 't'),
('taxi@moholz.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$TCAyMLkDNz0F7nceulTs4A$+dCc3qIYwS362mcrSH/Z7hmXx2KW5Ow5NLhZH0XpPEI',	'John',	NULL,	4, 't'),
('taxi@niesky.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$jxW4oxa3l0tg+OG3+4lllw$l5TN76xuwWqc01KNBHB37WukqjmqjKsm/ZBF2y+NvPY',	'John',	NULL,	5, 't'),
('taxi@rothenburg.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$dviKXplqYeVGdRA+UztyDg$/rQUv5OVgKufsy6VqYtFhXfE6jaHOCV6oE+3aDZVGMo',	'John',	NULL,	6, 't'),
('taxi@schoepstal.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$B7mjUX8IFZv+1G/jiu2dSQ$xGhHcG8PKvDYLwydw2aVVqaaovdjFanlIrBjF0TgDkI',	'John',	NULL,	7, 't'),
('taxi@goerlitz.de',	't',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$6zvrI5rYSzw+NP8hRZ1Yxg$pAY9o3o3rhlCNGo2zVwP/Kq5YVOrm6yvLrqaSDeWxpw',	'John',	NULL,	8, 't'),
('fahrer@test.de',	'f',	'f',	'$argon2id$v=19$m=19456,t=2,p=1$6zvrI5rYSzw+NP8hRZ1Yxg$pAY9o3o3rhlCNGo2zVwP/Kq5YVOrm6yvLrqaSDeWxpw',	'John',	NULL,	1, 't');
