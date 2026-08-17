# Mockup Reference Findings — 2026-08-17

The supplied hoodie editor references show a burgundy front/back workflow and a forest front workflow. Both demonstrate the intended product family: pullover hoodie with hood, drawstrings, kangaroo pocket, cuffs, and ribbed hem. The current rendered silhouettes visibly retain white triangular gaps at the lower sleeve edges, indicating incomplete cutout/masking. The displayed chest artwork is a multi-color rectangular design placed on the front, while the editor exposes Front, Back, L.Sleeve, R.Sleeve, and Neck zones.

The canonical rebuild must therefore use one hoodie silhouette and one normalized coordinate frame for every color, with a paired front/back asset for every color and no fallback to a differently shaped source. Protected details must remain visible: hood opening and seams, drawstrings, kangaroo pocket, cuffs, sleeve edges, side seams, and hem. The acceptance test must fail if a color view has a different silhouette, if the back uses a different garment cut, or if transparent regions expose white wedges.

Sources: user-supplied references `/home/ubuntu/upload/pasted_file_z8sADk_image.png` and `/home/ubuntu/upload/pasted_file_OXQ5P2_image.png`.
