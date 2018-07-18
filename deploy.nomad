# There can only be a single job definition per file. This job is named
# "example" so it will create a job with the ID and Name "example".

# The "job" stanza is the top-most configuration option in the job
# specification. A job is a declarative specification of tasks that Nomad
# should run. Jobs have a globally unique name, one or many task groups, which
# are themselves collections of one or many tasks.
#
# For more information and examples on the "job" stanza, please see
# the online documentation at:
#
#     https://www.nomadproject.io/docs/job-specification/job.html
#
job "serial-experiments.com" {
  # The "region" parameter specifies the region in which to execute the job. If
  # omitted, this inherits the default region name of "global".
  # region = "global"

  # The "datacenters" parameter specifies the list of datacenters which should
  # be considered when placing this task. This must be provided.
  datacenters = [
    "dc1"
  ]

  # The "type" parameter controls the type of job, which impacts the scheduler's
  # decision on placement. This configuration is optional and defaults to
  # "service". For a full list of job types and their differences, please see
  # the online documentation.
  #
  # For more information, please see the online documentation at:
  #
  #     https://www.nomadproject.io/docs/jobspec/schedulers.html
  #
  type = "service"

  # The "constraint" stanza defines additional constraints for placing this job,
  # in addition to any resource or driver constraints. This stanza may be placed
  # at the "job", "group", or "task" level, and supports variable interpolation.
  #
  # For more information and examples on the "constraint" stanza, please see
  # the online documentation at:
  #
  #     https://www.nomadproject.io/docs/job-specification/constraint.html
  #
  # constraint {
  #   attribute = "${attr.kernel.name}"
  #   value     = "linux"
  # }

  # The "update" stanza specifies the update strategy of task groups. The update
  # strategy is used to control things like rolling upgrades, canaries, and
  # blue/green deployments. If omitted, no update strategy is enforced. The
  # "update" stanza may be placed at the job or task group. When placed at the
  # job, it applies to all groups within the job. When placed at both the job and
  # group level, the stanzas are merged with the group's taking precedence.
  #
  # For more information and examples on the "update" stanza, please see
  # the online documentation at:
  #
  #     https://www.nomadproject.io/docs/job-specification/update.html
  #
  update {
    # The "max_parallel" parameter specifies the maximum number of updates to
    # perform in parallel. In this case, this specifies to update a single task
    # at a time.
    max_parallel = 1

    # The "min_healthy_time" parameter specifies the minimum time the allocation
    # must be in the healthy state before it is marked as healthy and unblocks
    # further allocations from being updated.
    min_healthy_time = "10s"

    # The "healthy_deadline" parameter specifies the deadline in which the
    # allocation must be marked as healthy after which the allocation is
    # automatically transitioned to unhealthy. Transitioning to unhealthy will
    # fail the deployment and potentially roll back the job if "auto_revert" is
    # set to true.
    healthy_deadline = "3m"

    # The "progress_deadline" parameter specifies the deadline in which an
    # allocation must be marked as healthy. The deadline begins when the first
    # allocation for the deployment is created and is reset whenever an allocation
    # as part of the deployment transitions to a healthy state. If no allocation
    # transitions to the healthy state before the progress deadline, the
    # deployment is marked as failed.
    progress_deadline = "10m"

    # The "auto_revert" parameter specifies if the job should auto-revert to the
    # last stable job on deployment failure. A job is marked as stable if all the
    # allocations as part of its deployment were marked healthy.
    auto_revert = false

    # The "canary" parameter specifies that changes to the job that would result
    # in destructive updates should create the specified number of canaries
    # without stopping any previous allocations. Once the operator determines the
    # canaries are healthy, they can be promoted which unblocks a rolling update
    # of the remaining allocations at a rate of "max_parallel".
    #
    # Further, setting "canary" equal to the count of the task group allows
    # blue/green deployments. When the job is updated, a full set of the new
    # version is deployed and upon promotion the old version is stopped.
    canary = 0
  }

  # The migrate stanza specifies the group's strategy for migrating off of
  # draining nodes. If omitted, a default migration strategy is applied.
  #
  # For more information on the "migrate" stanza, please see
  # the online documentation at:
  #
  #     https://www.nomadproject.io/docs/job-specification/migrate.html
  #
  migrate {
    # Specifies the number of task groups that can be migrated at the same
    # time. This number must be less than the total count for the group as
    # (count - max_parallel) will be left running during migrations.
    max_parallel = 1

    # Specifies the mechanism in which allocations health is determined. The
    # potential values are "checks" or "task_states".
    health_check = "checks"

    # Specifies the minimum time the allocation must be in the healthy state
    # before it is marked as healthy and unblocks further allocations from being
    # migrated. This is specified using a label suffix like "30s" or "15m".
    min_healthy_time = "10s"

    # Specifies the deadline in which the allocation must be marked as healthy
    # after which the allocation is automatically transitioned to unhealthy. This
    # is specified using a label suffix like "2m" or "1h".
    healthy_deadline = "5m"
  }

  # The "group" stanza defines a series of tasks that should be co-located on
  # the same Nomad client. Any task within a group will be placed on the same
  # client.
  #
  # For more information and examples on the "group" stanza, please see
  # the online documentation at:
  #
  #     https://www.nomadproject.io/docs/job-specification/group.html
  #
  group "website" {
    # The "count" parameter specifies the number of the task groups that should
    # be running under this group. This value must be non-negative and defaults
    # to 1.
    count = 1

    # The "restart" stanza configures a group's behavior on task failure. If
    # left unspecified, a default restart policy is used based on the job type.
    #
    # For more information and examples on the "restart" stanza, please see
    # the online documentation at:
    #
    #     https://www.nomadproject.io/docs/job-specification/restart.html
    #
    restart {
      # The number of attempts to run the job within the specified interval.
      attempts = 2
      interval = "30m"

      # The "delay" parameter specifies the duration to wait before restarting
      # a task after it has failed.
      delay = "15s"

      # The "mode" parameter controls what happens when a task has restarted
      # "attempts" times within the interval. "delay" mode delays the next
      # restart until the next interval. "fail" mode does not restart the task
      # if "attempts" has been hit within the interval.
      mode = "fail"
    }

    # The "ephemeral_disk" stanza instructs Nomad to utilize an ephemeral disk
    # instead of a hard disk requirement. Clients using this stanza should
    # not specify disk requirements in the resources stanza of the task. All
    # tasks in this group will share the same ephemeral disk.
    #
    # For more information and examples on the "ephemeral_disk" stanza, please
    # see the online documentation at:
    #
    #     https://www.nomadproject.io/docs/job-specification/ephemeral_disk.html
    #
    ephemeral_disk {
      # When sticky is true and the task group is updated, the scheduler
      # will prefer to place the updated allocation on the same node and
      # will migrate the data. This is useful for tasks that store data
      # that should persist across allocation updates.
      # sticky = true
      #
      # Setting migrate to true results in the allocation directory of a
      # sticky allocation directory to be migrated.
      # migrate = true

      # The "size" parameter specifies the size in MB of shared ephemeral disk
      # between tasks in the group.
      size = 300
    }

    # The "task" stanza creates an individual unit of work, such as a Docker
    # container, web application, or batch processing.
    #
    # For more information and examples on the "task" stanza, please see
    # the online documentation at:
    #
    #     https://www.nomadproject.io/docs/job-specification/task.html
    #
    task "web" {
      # The "driver" parameter specifies the task driver that should be used to
      # run the task.
      driver = "docker"

      # The "config" stanza specifies the driver configuration, which is passed
      # directly to the driver to start the task. The details of configurations
      # are specific to each driver, so please see specific driver
      # documentation for more information.
      config {
        image = "eduwass/docker-nginx-php-git"
        port_map {
          http = 80
        }
      }

      env {
        # repository to load code from
        GIT_REPO = "git@git.serial-experiments.com:bart/serial-experiments.com.git"
        # branch to load
        GIT_BRANCH = "master"
        # deployment key for this repository
        SSH_KEY = "LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcFFJQkFBS0NBUUVBbWRvbnFYVmp4OVdKKzhDZ0RLK3haTG90Vm1XNy9NSmVOVlZXQUFLRGJRbVB1MWs3CkN5V05IUHUwOG91ZjZBWGZoQTBVZnFWRHAxZ0Fzby9yZ3pJRTFZYVlEZm9ETUZtVFN4TkVodTF3alUyQytTTWYKUjFzeWVqRk5lTkNISVpMejlnNlpFTTNodHBHdERzTkxvWmFjTUlPK3FpSmNrS2dKODIxR3Y5bE5XUUprT1ZxUQpzYVdyUGdFc0E0em9HZE1LWWFnV3FtKzJvamhrblgvNmlaZjVGT3dvTEc1QTQ2ekNtcXVzcDdTcDZkdkNvYVNnCnVMdml4VUVWWERsN1gwcDZ0Qk8vYzB0eFFMNktxUU02R1gxSEhIUjV0eEhOak9meXBhZXdRa0tXZ0t6V3pabTYKcjJyVmpkeW9hcUNnRGdMUXE4YkErV3FGT29vRW5QU0JZWXFteXdJREFRQUJBb0lCQVFDQUIydWo5LzB0eVlTRwp6SmdqbG4wdmprSzJOL2pFOE5aRzJabTBibU1COU1mNEp0d2NmWVk5alRUWjlkaiswd3hhcml2VTdDQXRmTzB2CnF0WlltZUl0OGxCTXFUWElJWEtTTWhsL2tzMXJ1UW41MndGbmR2dTlkWk83cXdRWXExcDY4MURyQy9qOTNhSSsKdThRUFZ1N283R2xZMlRsZ1k0WE1YYTVYYmpTUWtVT1VMdUc0L3dWVkplUm8wTGZQZFZGMWNoc3c1bk01ajBONwpBaXN2NnExL2pSTVN3WkhRa2NrWlpjQ0plRk92Ull6TzNldGRxeVY2dVBSUkR3MUcwZnc5eW8zZ1FQRDRJMGF4CnJVZjJIWVhyYUtDaUNBdEJNdXU3YUlsZkdjQzVNakh3bnZVMnFJTG45NFRjdXZiNXRLZGo0b3NWQWVDNGpITWwKZjQ1RlVhOEJBb0dCQU1qY1QwczlnTU42MHhBb2Qza2pKZ3FaVnczcGNpc1ZBT1JwMW9JMnV2ODhVYVh1NFVRaQpmQlFDTkZGMmdDR0hWTnNaYm04UThXV1V4dmpaWUt3RUhjNnRydndiazdPMWVVWkhhVWZ4Vlg3aDFpVXVmOU5zCmZHeTlZT0JsZDdYZFo2eWRwSk5VRUFyQmNsMmxKTnBET281QmpJZ1RHd3hZemtBLzhyTjd5THBMQW9HQkFNUVcKUjJYaGZsYjM5KzFtYVlpMGVZNnM3Y0dxdnpkLzdpa2NrdFJqVFd1VkJuRHBKemVuc3RjcVhQQTMzSzJRVDg0ZgpCT0c3U2FhREJTQTBqWTJnTlhWK3dCTFFZbFhxNVphL2g1V2UrQjBoZXEyNkdCWEUwYnlRUFAwQys1ZmhURUhECkEzNnYzUFhscVoyaWJ3bjlMZS9ocGp1V05nOVFwZ3lPNXRDRWNmV0JBb0dCQUowYWxIckpORG14aS95TGFrYzUKa3J1ZmpGTzVVQzhhVW9SVnRBNU5PSjRDVStweG1ZaHRZSmRWMGc0Vm5jcWJ5MmREMFBqV1M3bWtVS3k3ZWIyUgp5cTZwY3NDRjRWVWlrQ1RFSGpqRExwZjdsRCtveXhwWE5FcnBKU2pldEc5dktYUCtLWWVDckxsODdUTUp4SFZqCk9CMmtiNExQVHN5dGVVVVB2NGxiUEhsWkFvR0FaNE92VzF4SDJ0ZDZ2WXVUNk1RRmE4bGtsaGx5YW5VUm9BaGkKaHRhSlYyTExqSzI0czB2SFFJa3ZtT3lVaGRlcUdaRU1mYkhtTm8zeUZjZElkdHg5ZkRKV2FWZ3lvVktvc3dVWApLV2hMYU8xMG11T2p0Vkk2dW9XV2ZLYW5kTTFOK1dWZW9mRnEvekNuY3Z6K0MxTHBmam9zREViRzhSek5HOUlRCmpVRnQrNEVDZ1lFQWp1b3J3cDZlT2NLQm1pdlVyUFdYU2hsSFdaTlVCemdENTVRUTNjRzFpbDgyZDBOK3VVaUEKQWZ5c3o0elFJVG14SXdMV05mbXRQUzN1a0JZTDNFNzRSK3NkQ2hlemYrZklNZ2g3eGpnVWNGQzBZWFptdnFYOAp0eEhYMmE2MFN1REIrUUUvOVZLZWxqOW5aWUR2dzRnU3YzWWJDRElkbEsrVURDZm55TTRlcnJ3PQotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo="
        # webroot to run, code in /var/www/html
        WEBROOT = "/var/www/html"
      }

      # The "artifact" stanza instructs Nomad to download an artifact from a
      # remote source prior to starting the task. This provides a convenient
      # mechanism for downloading configuration files or data needed to run the
      # task. It is possible to specify the "artifact" stanza multiple times to
      # download multiple artifacts.
      #
      # For more information and examples on the "artifact" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/artifact.html
      #
      # artifact {
      #   source = "http://foo.com/artifact.tar.gz"
      #   options {
      #     checksum = "md5:c4aa853ad2215426eb7d70a21922e794"
      #   }
      # }

      # The "logs" stanza instructs the Nomad client on how many log files and
      # the maximum size of those logs files to retain. Logging is enabled by
      # default, but the "logs" stanza allows for finer-grained control over
      # the log rotation and storage configuration.
      #
      # For more information and examples on the "logs" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/logs.html
      #
      # logs {
      #   max_files     = 10
      #   max_file_size = 15
      # }

      # The "resources" stanza describes the requirements a task needs to
      # execute. Resource requirements include memory, network, cpu, and more.
      # This ensures the task will execute on a machine that contains enough
      # resource capacity.
      #
      # For more information and examples on the "resources" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/resources.html
      #
      resources {
        cpu = 250
        # 500 MHz
        memory = 128
        # 256MB
        network {
          mbits = 10
          port "http" {}
        }
      }

      # The "service" stanza instructs Nomad to register this task as a service
      # in the service discovery engine, which is currently Consul. This will
      # make the service addressable after Nomad has placed it on a host and
      # port.
      #
      # For more information and examples on the "service" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/service.html
      #
      service {
        name = "serial-experiments-web"
        tags = [
          "global",
          "http",
          "urlprefix-serial-experiments.com/",
          "urlprefix-www.serial-experiments.com/"
        ]
        port = "http"
        check {
          name = "serial-experiments.com up"
          type = "http"
          port = "http"
          path = "/"
          interval = "10s"
          timeout = "2s"
        }
      }

      # The "template" stanza instructs Nomad to manage a template, such as
      # a configuration file or script. This template can optionally pull data
      # from Consul or Vault to populate runtime configuration data.
      #
      # For more information and examples on the "template" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/template.html
      #
      # template {
      #   data          = "---\nkey: {{ key \"service/my-key\" }}"
      #   destination   = "local/file.yml"
      #   change_mode   = "signal"
      #   change_signal = "SIGHUP"
      # }

      # The "template" stanza can also be used to create environment variables
      # for tasks that prefer those to config files. The task will be restarted
      # when data pulled from Consul or Vault changes.
      #
      # template {
      #   data        = "KEY={{ key \"service/my-key\" }}"
      #   destination = "local/file.env"
      #   env         = true
      # }

      # The "vault" stanza instructs the Nomad client to acquire a token from
      # a HashiCorp Vault server. The Nomad servers must be configured and
      # authorized to communicate with Vault. By default, Nomad will inject
      # The token into the job via an environment variable and make the token
      # available to the "template" stanza. The Nomad client handles the renewal
      # and revocation of the Vault token.
      #
      # For more information and examples on the "vault" stanza, please see
      # the online documentation at:
      #
      #     https://www.nomadproject.io/docs/job-specification/vault.html
      #
      # vault {
      #   policies      = ["cdn", "frontend"]
      #   change_mode   = "signal"
      #   change_signal = "SIGHUP"
      # }

      # Controls the timeout between signalling a task it will be killed
      # and killing the task. If not set a default is used.
      # kill_timeout = "20s"
    }
  }
}
