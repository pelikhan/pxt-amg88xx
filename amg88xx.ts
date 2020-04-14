namespace amg88xx {
    // Registers are defined below in the class. These are possible register values.
    // Operating Modes
    // pylint: disable=bad-whitespace
    const _NORMAL_MODE = 0x00;
    const _SLEEP_MODE = 0x10
    const _STAND_BY_60 = 0x20
    const _STAND_BY_10 = 0x21
    // sw resets
    const _FLAG_RESET = 0x30
    const _INITIAL_RESET = 0x3F
    // frame rates
    const _FPS_10 = 0x00
    const _FPS_1 = 0x01
    // int enables
    const _INT_DISABLED = 0x00
    const _INT_ENABLED = 0x01
    // int modes
    const _DIFFERENCE = 0x00
    const _ABSOLUTE_VALUE = 0x01
    const _INT_OFFSET = 0x010
    const _PIXEL_OFFSET = 0x80
    const _PIXEL_ARRAY_WIDTH = 8
    const _PIXEL_ARRAY_HEIGHT = 8
    const _PIXEL_TEMP_CONVERSION = 0.25
    const _THERMISTOR_CONVERSION = 0.0625
    // pylint: enable=bad-whitespace
    function _signed_12bit_to_float(val: number): number {
        // take first 11 bits as absolute val
        let abs_val = val & 0x7FF
        if (val & 0x800) {
            return 0 - abs_val;
        }
        
        return abs_val;
    }
    
    function _twos_comp_to_float(val: number): number {
        val &= 0xFFF
        if (val & 0x800) {
            val -= 0x1000
        }
        
        return val;
    }
    
    export class AMG88XX {
        i2c_device: pins.I2CDevice;
        // Set up the registers
        private static _pctl = new register.I2CRWBits(8, 0x00, 0)
        private static _rst = new register.I2CRWBits(8, 0x01, 0)
        private static _fps = new register.I2CRWBit(0x02, 0)
        private static _inten = new register.I2CRWBit(0x03, 0)
        private static _intmod = new register.I2CRWBit(0x03, 1)
        private static _intf = new register.I2CRWBit(0x04, 1)
        private static _ovf_irs = new register.I2CRWBit(0x04, 2)
        private static _ovf_ths = new register.I2CRWBit(0x04, 3)
        private static _intclr = new register.I2CRWBit(0x05, 1)
        private static _ovs_clr = new register.I2CRWBit(0x05, 2)
        private static _ovt_clr = new register.I2CRWBit(0x05, 3)
        private static _mamod = new register.I2CRWBit(0x07, 5)
        private static _inthl = new register.I2CRWBits(8, 0x08, 0)
        private static _inthh = new register.I2CRWBits(4, 0x09, 0)
        private static _intll = new register.I2CRWBits(8, 0x0A, 0)
        private static _intlh = new register.I2CRWBits(4, 0x0B, 0)
        private static _ihysl = new register.I2CRWBits(8, 0x0C, 0)
        private static _ihysh = new register.I2CRWBits(4, 0x0D, 0)
        private static _tthl = new register.I2CRWBits(8, 0x0E, 0)
        private static _tthh = new register.I2CRWBits(4, 0x0F, 0)
        
        constructor(i2c: I2C, addr: number = 0x69) {
            this.i2c_device = new pins.I2CDevice(addr, /*i2c*/)
            // enter normal mode
            AMG88XX._pctl.setValue(this.i2c_device, _NORMAL_MODE)
            // software reset
            AMG88XX._rst.setValue(this.i2c_device, _INITIAL_RESET)
            // disable interrupts by default
            AMG88XX._inten.setValue(this.i2c_device, false)
            // set to 10 FPS
            AMG88XX._fps.setValue(this.i2c_device, !!_FPS_10) // dubious
        }
        
        /** 
         * Temperature of the sensor in Celsius 
         **/
        temperature(): number {
            let raw = AMG88XX._tthh.value(this.i2c_device) << 8 | AMG88XX._tthl.value(this.i2c_device)
            return _signed_12bit_to_float(raw) * _THERMISTOR_CONVERSION
        }
        
        /** 
        * Temperature of each pixel across the sensor in Celsius.
        * Temperatures are stored in a two dimensional list where the first index is the row and
        * the second is the column. The first row is on the side closest to the writing on the sensor.
        */
        pixels(): Buffer {
            const retbuf = pins.createBuffer(64) 
            let buf = pins.createBuffer(3)
            const i2c = this.i2c_device.begin()
            for (let row = 0; row < _PIXEL_ARRAY_HEIGHT; ++row) {
                for (let col = 0; col < _PIXEL_ARRAY_WIDTH; ++col) {
                    let i = row * _PIXEL_ARRAY_HEIGHT + col
                    buf[0] = _PIXEL_OFFSET + (i << 1)
                    register.write_then_readinto(i2c, buf, buf, 1, 1)
                    let raw = buf[2] << 8 | buf[1]
                    retbuf[row * _PIXEL_ARRAY_HEIGHT + col] = _twos_comp_to_float(raw) * _PIXEL_TEMP_CONVERSION
                }
            }
            i2c.end()
            return retbuf;
        }   
    }
}
