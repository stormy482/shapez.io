import { Loader } from "../../core/loader";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { enumAngleToDirection, enumDirection, Vector } from "../../core/vector";
import { SOUNDS } from "../../platform/sound";
import { T } from "../../translations";
import { PipeComponent, enumPipeType, enumPipeVariant } from "../components/pipe";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { THEME } from "../theme";

/** @enum {string} */
export const pipeVariants = {
    industrial: "industrial",
};

const enumPipeVariantToVariant = {
    [defaultBuildingVariant]: enumPipeVariant.pipe,
    [pipeVariants.industrial]: enumPipeVariant.industrial,
};

export const arrayPipeVariantToRotation = [enumDirection.top, enumDirection.left, enumDirection.right];

export const pipeOverlayMatrices = {
    [enumDirection.top]: generateMatrixRotations([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    [enumDirection.left]: generateMatrixRotations([0, 0, 0, 1, 1, 0, 0, 1, 0]),
    [enumDirection.right]: generateMatrixRotations([0, 0, 0, 0, 1, 1, 0, 1, 0]),
};

export class MetaPipeBuilding extends MetaBuilding {
    constructor() {
        super("pipe");
    }

    getHasDirectionLockAvailable() {
        return true;
    }

    getSilhouetteColor() {
        return "#61ef6f";
    }

    getStayInPlacementMode() {
        return true;
    }

    getPlacementSound() {
        return SOUNDS.placeBelt;
    }

    getRotateAutomaticallyWhilePlacing() {
        return true;
    }

    getSprite() {
        return null;
    }

    /**
     *
     *@param {string} variant
     */
    isPlaceableToFluid(variant) {
        switch (variant) {
            case defaultBuildingVariant:
                return true;
            case enumPipeVariant.industrial:
                return false;
        }
    }

    getIsReplaceable() {
        return true;
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true;
    }

    getAvailableVariants(root) {
        let variants = [defaultBuildingVariant, enumPipeVariant.industrial];
        // variants.push(enumPipeVariant.industrial);
        return variants;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new PipeComponent({}));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        entity.components.Pipe.variant = variant;
        entity.components.Pipe.direction = arrayPipeVariantToRotation[rotationVariant];
    }

    /**
     *
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        return pipeOverlayMatrices[entity.components.Pipe.direction][rotation];
    }

    /**
     *
     * @param {number} rotationVariant
     * @param {string} variant
     * @returns {import("../../core/draw_utils").AtlasSprite}
     */
    getPreviewSprite(rotationVariant, variant) {
        const pipeVariant = enumPipeVariantToVariant[variant];
        switch (arrayPipeVariantToRotation[rotationVariant]) {
            case enumDirection.top: {
                return Loader.getSprite("sprites/pipes/" + pipeVariant + "_top.png");
            }
            case enumDirection.left: {
                return Loader.getSprite("sprites/pipes/" + pipeVariant + "_left.png");
            }
            case enumDirection.right: {
                return Loader.getSprite("sprites/pipes/" + pipeVariant + "_right.png");
            }
            default: {
                assertAlways(false, "Invalid belt rotation variant");
            }
        }
    }

    getBlueprintSprite(rotationVariant, variant) {
        return this.getPreviewSprite(rotationVariant, variant);
    }

    /**
     * Should compute the optimal rotation variant on the given tile
     * @param {object} param0
     * @param {GameRoot} param0.root
     * @param {Vector} param0.tile
     * @param {number} param0.rotation
     * @param {string} param0.variant
     * @param {Layer} param0.layer
     * @return {{ rotation: number, rotationVariant: number, connectedEntities?: Array<Entity> }}
     */
    computeOptimalDirectionAndRotationVariantAtTile({ root, tile, rotation, variant, layer }) {
        const topDirection = enumAngleToDirection[rotation];
        const rightDirection = enumAngleToDirection[(rotation + 90) % 360];
        const bottomDirection = enumAngleToDirection[(rotation + 180) % 360];
        const leftDirection = enumAngleToDirection[(rotation + 270) % 360];

        console.log(variant);
        const { ejectors, acceptors } = root.logic.getEjectorsAndAcceptorsAtTileForPipes(tile, variant);

        let hasBottomEjector = false;
        let hasRightEjector = false;
        let hasLeftEjector = false;

        let hasTopAcceptor = false;
        let hasLeftAcceptor = false;
        let hasRightAcceptor = false;

        // Check all ejectors
        for (let i = 0; i < ejectors.length; ++i) {
            const ejector = ejectors[i];

            if (ejector.toDirection === topDirection) {
                hasBottomEjector = true;
            } else if (ejector.toDirection === leftDirection) {
                hasRightEjector = true;
            } else if (ejector.toDirection === rightDirection) {
                hasLeftEjector = true;
            }
        }

        // Check all acceptors
        for (let i = 0; i < acceptors.length; ++i) {
            const acceptor = acceptors[i];
            if (acceptor.fromDirection === bottomDirection) {
                hasTopAcceptor = true;
            } else if (acceptor.fromDirection === rightDirection) {
                hasLeftAcceptor = true;
            } else if (acceptor.fromDirection === leftDirection) {
                hasRightAcceptor = true;
            }
        }

        // Soo .. if there is any ejector below us we always prioritize
        // this ejector
        if (!hasBottomEjector) {
            // When something ejects to us from the left and nothing from the right,
            // do a curve from the left to the top

            if (hasRightEjector && !hasLeftEjector) {
                return {
                    rotation: (rotation + 270) % 360,
                    rotationVariant: 2,
                };
            }

            // When something ejects to us from the right and nothing from the left,
            // do a curve from the right to the top
            if (hasLeftEjector && !hasRightEjector) {
                return {
                    rotation: (rotation + 90) % 360,
                    rotationVariant: 1,
                };
            }
        }

        // When there is a top acceptor, ignore sides
        // NOTICE: This makes the belt prefer side turns *way* too much!
        if (!hasTopAcceptor) {
            // When there is an acceptor to the right but no acceptor to the left,
            // do a turn to the right
            if (hasRightAcceptor && !hasLeftAcceptor) {
                return {
                    rotation,
                    rotationVariant: 2,
                };
            }

            // When there is an acceptor to the left but no acceptor to the right,
            // do a turn to the left
            if (hasLeftAcceptor && !hasRightAcceptor) {
                return {
                    rotation,
                    rotationVariant: 1,
                };
            }
        }

        return {
            rotation,
            rotationVariant: 0,
        };
    }
}
