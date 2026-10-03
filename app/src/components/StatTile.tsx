import { motion } from "framer-motion";
import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <motion.div
      className={styles.tile}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </motion.div>
  );
}
