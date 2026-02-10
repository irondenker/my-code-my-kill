import { Router } from "express";
import * as ejs from "ejs";
import { getLabOptions } from "../config/lab-options.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();

function isSstiLabEnabled(): boolean {
    return getLabOptions().ssti;
}

router.get("/labs", (_req, res) => {
    return res.render("lab/index", {
        sstiEnabled: isSstiLabEnabled(),
    });
});

router.get("/labs/ssti", (req, res, next) => {
    const labEnabled = isSstiLabEnabled();
    if (!labEnabled) {
        return res.status(200).render("lab/ssti", {
            titleInput: "",
            templateInput: "",
            renderedOutput: "",
            renderError: "SSTI lab is disabled.",
            labEnabled,
        });
    }

    return res.render("lab/ssti", {
        titleInput: "",
        templateInput: "",
        renderedOutput: "",
        renderError: null,
        labEnabled,
    });
});

router.post("/labs/ssti", (req, res, next) => {
    const labEnabled = isSstiLabEnabled();
    if (!labEnabled) {
        return res.status(200).render("lab/ssti", {
            titleInput: "",
            templateInput: "",
            renderedOutput: "",
            renderError: "SSTI lab is disabled.",
            labEnabled,
        });
    }

    const titleInput = typeof req.body?.title === "string" ? req.body.title : "";
    const templateInput = typeof req.body?.template === "string" ? req.body.template : "";
    let renderedOutput = "";
    let renderError: string | null = null;

    try {
        renderedOutput = ejs.render(
            templateInput,
            {
                title: titleInput,
                sessionUser: req.session?.username ?? null,
                now: new Date(),
            },
            {
                filename: "lab-ssti",
            },
        );
    } catch (err) {
        renderError = err instanceof Error ? err.message : "Unknown error";
    }

    return res.render("lab/ssti", {
        titleInput,
        templateInput,
        renderedOutput,
        renderError,
        labEnabled,
    });
});

export default router;
