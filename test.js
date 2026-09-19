const req = { body: { orgId: null } };
const { orgId } = req.body;
const normalizedOrgId = orgId?.trim() || undefined;
console.log("normalizedOrgId:", normalizedOrgId);
if (normalizedOrgId) {
    console.log("inside if");
} else {
    console.log("inside else");
}
