const bcrypt = require('bcryptjs');
const hash = '$2b$10$AmpFKjKSql.k2HpbeXE97.d0G27fSY9UfMJvdt9RoCQco1RIT9FlG';
console.log(bcrypt.compareSync('password', hash));
