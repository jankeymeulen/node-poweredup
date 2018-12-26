import { Peripheral } from "noble";

import { LPF2Hub } from "./lpf2hub";
import { Port } from "./port";

import * as Consts from "./consts";

import Debug = require("debug");
const debug = Debug("duploTrainBase");


/**
 * The DuploTrainBase is emitted if the discovered device is a Duplo Train Base.
 * @class DuploTrainBase
 * @extends LPF2Hub
 * @extends Hub
 */
export class DuploTrainBase extends LPF2Hub {


    // We set JSDoc to ignore these events as a Duplo Train Base will never emit them.

    /**
     * @event DuploTrainBase#distance
     * @ignore
     */

    /**
     * @event DuploTrainBase#tilt
     * @ignore
     */

    /**
     * @event DuploTrainBase#rotate
     * @ignore
     */

    /**
     * @event DuploTrainBase#button
     * @ignore
     */

    /**
     * @event DuploTrainBase#attach
     * @ignore
     */

    /**
     * @event DuploTrainBase#detach
     * @ignore
     */


    public static IsDuploTrainBase (peripheral: Peripheral) {
        return (peripheral.advertisement.serviceUuids.indexOf(Consts.BLEServices.LPF2_HUB.replace(/-/g, "")) >= 0 && peripheral.advertisement.manufacturerData[3] === Consts.BLEManufacturerData.DUPLO_TRAIN_HUB_ID);
    }


    constructor (peripheral: Peripheral, autoSubscribe: boolean = true) {
        super(peripheral, autoSubscribe);
        this.type = Consts.Hubs.DUPLO_TRAIN_HUB;
        this._ports = {
            "MOTOR": new Port("MOTOR", 0),
            "COLOR": new Port("COLOR", 18),
            "SPEEDOMETER": new Port("SPEEDOMETER", 19)
        };
        debug("Discovered Duplo Train Base");
    }


    public connect () {
        return new Promise(async (resolve, reject) => {
            debug("Connecting to Duplo Train Base");
            await super.connect();
            debug("Connect completed");
            return resolve();
        });
    }


    /**
     * Set the color of the LED on the train via a color value.
     * @method DuploTrainBase#setLEDColor
     * @param {number} color A number representing one of the LED color consts.
     * @returns {Promise} Resolved upon successful issuance of command.
     */
    public setLEDColor (color: number | boolean) {
        return new Promise((resolve, reject) => {
            if (color === false) {
                color = 0;
            }
            const data = Buffer.from([0x81, 0x11, 0x11, 0x51, 0x00, color]);
            this._writeMessage(Consts.BLECharacteristics.LPF2_ALL, data);
            return resolve();
        });
    }


    /**
     * Set the motor speed on a given port.
     * @method DuploTrainBase#setMotorSpeed
     * @param {string} port
     * @param {number | Array.<number>} speed For forward, a value between 1 - 100 should be set. For reverse, a value between -1 to -100. Stop is 0. If you are specifying port AB to control both motors, you can optionally supply a tuple of speeds.
     * @param {number} [time] How long to activate the motor for (in milliseconds). Leave empty to turn the motor on indefinitely.
     * @returns {Promise} Resolved upon successful completion of command. If time is specified, this is once the motor is finished.
     */
    public setMotorSpeed (port: string, speed: number, time?: number | boolean) {
        const portObj = this._portLookup(port);
        let cancelEventTimer = true;
        if (typeof time === "boolean") {
            if (time === true) {
                cancelEventTimer = false;
            }
            time = undefined;
        }
        if (cancelEventTimer) {
            portObj.cancelEventTimer();
        }
        return new Promise((resolve, reject) => {
            if (time && typeof time === "number") {
                const data = Buffer.from([0x81, portObj.value, 0x11, 0x51, 0x00, this._mapSpeed(speed)]);
                this._writeMessage(Consts.BLECharacteristics.LPF2_ALL, data);
                const timeout = global.setTimeout(() => {
                    const data = Buffer.from([0x81, portObj.value, 0x11, 0x51, 0x00, 0x00]);
                    this._writeMessage(Consts.BLECharacteristics.LPF2_ALL, data);
                    return resolve();
                }, time);
                portObj.setEventTimer(timeout);
            } else {
                const data = Buffer.from([0x81, portObj.value, 0x11, 0x51, 0x00, this._mapSpeed(speed)]);
                this._writeMessage(Consts.BLECharacteristics.LPF2_ALL, data);
                return resolve();
            }
        });
    }


    /**
     * Play a built-in train sound.
     * @method DuploTrainBase#playSound
     * @param {number} sound A number representing one of the Train Base sound consts.
     * @returns {Promise} Resolved upon successful issuance of command.
     *
     * For the 10874 Duplo Train Set these sounds are
     *  2 = brake
     *  4 = chime
     *  6 = refill
     *  8 = whistle
     *  9 = kachung (like when reversing)
     */
    public playSound (sound: number) {
        return new Promise((resolve, reject) => {
            const data = Buffer.from([0x81, 0x01, 0x11, 0x51, 0x01, sound]);
            this._writeMessage(Consts.BLECharacteristics.LPF2_ALL, data);
            return resolve();
        });
    }


    /**
     * Ramp the motor speed on a given port.
     * @method DuploTrainBase#rampMotorSpeed
     * @param {string} port
     * @param {number} fromSpeed For forward, a value between 1 - 100 should be set. For reverse, a value between -1 to -100. Stop is 0.
     * @param {number} toSpeed For forward, a value between 1 - 100 should be set. For reverse, a value between -1 to -100. Stop is 0.
     * @param {number} time How long the ramp should last (in milliseconds).
     * @returns {Promise} Resolved upon successful completion of command.
     */
    public rampMotorSpeed (port: string, fromSpeed: number, toSpeed: number, time: number) {
        const portObj = this._portLookup(port);
        portObj.cancelEventTimer();
        return new Promise((resolve, reject) => {
            this._calculateRamp(fromSpeed, toSpeed, time, portObj)
            .on("changeSpeed", (speed) => {
                this.setMotorSpeed(port, speed, true);
            })
            .on("finished", resolve);
        });
    }


}
