pub struct FastRng {
    state: u32,
}

impl FastRng {
    pub fn new(seed: u32) -> Self {
        Self {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    #[allow(unused)]
    pub fn next_u32(&mut self) -> u32 {
        // xorshift32
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }

    pub fn next_f32(&mut self) -> f32 {
        // Produces a value in [0, 1)
        self.next_u32() as f32 / (u32::MAX as f32 + 1.0)
    }

    #[allow(unused)]
    pub fn range_f32(&mut self, min: f32, max: f32) -> f32 {
        min + (max - min) * self.next_f32()
    }
}
