import { createHash } from 'node:crypto';

export class EdgeEmbedder {
  readonly dim: number = 384;

  /**
   * Deterministic, subword feature projection mapping arbitrary text
   * into a 384-dimensional unit vector in cosine space.
   * Matches the Python backend LocalEmbedder._hash_vectorize exactly.
   */
  hashVectorize(text: string): Float32Array {
    const vec = new Float32Array(this.dim);
    const cleaned = text.toLowerCase().trim();
    const words = cleaned.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      vec[0] = 1.0;
      return vec;
    }

    const dimBig = BigInt(this.dim);

    for (const word of words) {
      // 1. Word token MD5 hash
      const md5Hex = createHash('md5').update(word, 'utf8').digest('hex');
      const h = BigInt('0x' + md5Hex);
      const idx = Number(h % dimBig);
      const sign = ((h >> 16n) & 1n) === 1n ? 1.0 : -1.0;
      vec[idx] += sign;

      // 2. Character 3-grams SHA256 hash
      if (word.length >= 3) {
        for (let i = 0; i <= word.length - 3; i++) {
          const sub = word.slice(i, i + 3);
          const shaHex = createHash('sha256').update(sub, 'utf8').digest('hex').slice(0, 8);
          const sh = BigInt('0x' + shaHex);
          const sIdx = Number(sh % dimBig);
          const sSign = ((sh >> 8n) & 1n) === 1n ? 1.0 : -1.0;
          vec[sIdx] += 0.5 * sSign;
        }
      }
    }

    // L2 Normalization
    let sumSq = 0;
    for (let i = 0; i < this.dim; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);

    if (norm > 1e-9) {
      for (let i = 0; i < this.dim; i++) {
        vec[i] /= norm;
      }
    } else {
      vec[0] = 1.0;
    }

    return vec;
  }

  embedText(text: string): Float32Array {
    const snippet = text.slice(0, 2000).trim();
    return this.hashVectorize(snippet);
  }

  /**
   * Computes cosine similarity between two L2-normalized unit vectors.
   * Because vectors are normalized, cosine similarity is simply the dot product.
   */
  cosineSimilarity(v1: Float32Array | number[], v2: Float32Array | number[]): number {
    let dot = 0;
    const len = Math.min(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
      dot += v1[i] * v2[i];
    }
    return Math.max(0, Math.min(1, dot));
  }
}

export const embedder = new EdgeEmbedder();

