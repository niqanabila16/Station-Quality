ALTER TABLE `stasiun` 
ADD CONSTRAINT `fk_stasiun_provinsi` 
FOREIGN KEY (`provinsi_id`) REFERENCES `provinsi` (`provinsi_id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stasiun` 
ADD CONSTRAINT `fk_stasiun_upt` 
FOREIGN KEY (`upt_id`) REFERENCES `upt` (`upt_id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stasiun` 
ADD CONSTRAINT `fk_stasiun_jaringan` 
FOREIGN KEY (`jaringan_id`) REFERENCES `jaringan` (`jaringan_id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stasiun_history` 
ADD CONSTRAINT `fk_history_stasiun` 
FOREIGN KEY (`stasiun_id`) REFERENCES `stasiun` (`stasiun_id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `availability` 
ADD CONSTRAINT `fk_availability_stasiun` 
FOREIGN KEY (`stasiun_id`) REFERENCES `stasiun` (`stasiun_id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `latency_history`
ADD CONSTRAINT `fk_latency_stasiun`
FOREIGN KEY (`stasiun_id`) REFERENCES `stasiun` (`stasiun_id`)
ON DELETE CASCADE ON UPDATE CASCADE;