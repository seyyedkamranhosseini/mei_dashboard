import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface FormTemplatesManagerProps {
  formType: "daily" | "concrete";
}

export function FormTemplatesManager({ formType }: FormTemplatesManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const { data: templates, refetch } = trpc.template.getTemplatesByType.useQuery(formType);
  const createMutation = trpc.template.createTemplate.useMutation();
  const deleteMutation = trpc.template.deleteTemplate.useMutation();

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      // For now, create with empty template data - admin can edit later
      await createMutation.mutateAsync({
        formType,
        name: templateName,
        description: templateDescription,
        templateData: {},
      });

      toast.success("Template created successfully");
      setTemplateName("");
      setTemplateDescription("");
      setIsOpen(false);
      await refetch();
    } catch (error) {
      toast.error("Failed to create template");
      console.error(error);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteMutation.mutateAsync(templateId);
      toast.success("Template deleted");
      await refetch();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleUseTemplate = (templateId: number) => {
    // This would navigate to the form with the template pre-filled
    toast.info("Template selected - form will be pre-filled");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Form Templates</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New {formType === "daily" ? "Daily Report" : "Concrete Test"} Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <Input
                  placeholder="e.g., Standard Foundation Inspection"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Describe when this template should be used..."
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate}>
                  Create Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  {template.description && (
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Created on {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUseTemplate(template.id)}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Use
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No templates yet. Create one to get started!</p>
        </Card>
      )}
    </div>
  );
}
