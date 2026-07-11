import SparkMD5 from 'spark-md5';

/** MD5 feature index — matches Python `int.from_bytes(md5(f'{seed}:{feature}').digest()[:4], 'big') % hashSize`. */
export function hashFeatureIndex(feature: string, hashSize: number, hashSeed: number): number {
  const hex = SparkMD5.hash(`${hashSeed}:${feature}`);
  const top = parseInt(hex.slice(0, 8), 16);
  return top % hashSize;
}